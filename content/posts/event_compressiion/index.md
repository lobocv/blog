---
title: "Event Compression / Deduplication"
draft: false
categories: ["Architecture"]
---

One of the prevailing forms of communication in modern microservice architectures is asynchronous messaging.
This is the backbone of the event-driven architecture model. In this model, services send messages to a message 
broker, which then distributes the messages interested to clients. A message can be used to describe an event in 
the system such as a creation or update of an entity. This allows you to loosely couple different components of your
system by having them publish or subscribe to events that they care about.

But what happens if there is a subscriber that wants to react to a group of events as an aggregate? In other words, what
if you wanted to do something only after all the `update` events stop being published, rather than reacting to each and
every one as they come in?

Let's look at a concrete example. 

### Aggregating Social Media Metrics

Let's say you are building a system that collects metrics on your social media posts. You want to provide both a individual
view of performance and view of your posts' performance as a whole. Let's call metrics on individual posts `post-level metrics`
and metrics on your posts as a whole `campaign-level metrics`. To simplify things, let's assume all metrics can be aggregated
using a sum:

```
Campaign-Level Metric = SUM(Post-Level Metrics) 
```

Now it's clear that campaign-level metrics depend on the post-level metrics. Every time a metric on a post changes, we will
need to recompute this sum. In an event-driven architecture, you may have a service that performs this computation by
listening to `post-metric-updated` events. If many of these events are produced within a short period of time, the service
will be computing the sum many times, with only the last computation being valuable (all other computations would produce 
a stale value). What we would really like to do in this situation is detect when the last `post-metric-updated` event comes
in and only then compute the sum. But how do you know which event is the last?

Determining which event is last is actually a difficult problem and can't really be solved generally. The concept of "last"
is a application specific. In our example, a post can have it's metrics updated at any time. If we are okay with some degree
of staleness to our campaign metrics, we can implement a delayed computation that occurs when we stop receiving events after
a defined amount of time.

### The Ideal Event

Ideally, what we would like is to have a slightly different event than our `post-metric-updated` event. What we really 
want is a `post-metric-last-updated-X-minutes-ago` event. If the `post-metric-updated` event contains a list of all
the metrics updated, then the `post-metric-last-updated-X-minutes-ago` event should contain all the metrics that were
updated within the last `X` minutes. Now the question becomes, how do we produce that event?

We need some code that will do the following:

- Listen for `post-metric-updated` events
- Keep a super-set of all the updated metrics in the events 
- Keep track of the last time a `post-metric-updated` event comes in
- Produce a `post-metric-last-updated-X-minutes-ago` when we don't receive an event for `X` minutes

This turns out to be fairly simple to implement with the use of Redis [sorted-sets](https://redis.io/topics/data-types).

### Sorted Set

A sorted set is a *unique* collection of strings that have an associated `score` which is used to sort the entries.
For example, a sorted set would be a perfect data structure for storing a user scoreboard:

| Rank | Name | Highscore     |
|------|------|---------------|
|   1   | Calvin     |  1050  |
|   2   | Abdul      |  800   |
|   3   | Pirakalan  |  760   |
|   4   | Nirav      |  600   |

We can include the data above into the sorted set and it will maintain it in ascending order of highscore.
It is then very simple to ask the sorted set for the top `N` results.

### Compressing Events

Since the sorted set can only have unique values, we can use it to "compress" several events into a single value.
In order to do that, we need to remove unique information from the events such that they serialize to the 
same value. We can use the time of the event as the `score` in the sorted set. Each time a value is updated, we update
the `score`, thus keeping track of the last event in the group. Our sorted set would then effectively hold a grouping 
of events in the value and the time of the last event in the group in the `score`. We can then regularly query the
sorted-set to get values with scores (timestamps) before than `time.Now()-X`. 
These values are then published as `post-metric-last-updated-X-minutes-ago` events.

Lets make things more concrete. Our `post-metric-updated` event has the following schema:

```
type PostMetricUpdatedEvent  struct {
	PostID string                      `json:"post_id"`
	CampaignID string                  `json:"campaign_id"`
	UpdatedMetrics map[string]float64  `json:"updated_metrics"`
}
```

And we have the following events being published, shown below in their JSON serialized form:

```
{"post_id": "post_1", "campaign_id": "campaign_1", "updated_metrics": {"likes": 10, "comments": 5}}
{"post_id": "post_2", "campaign_id": "campaign_1", "updated_metrics": {"likes": 25, "comments": 16}}
{"post_id": "post_3", "campaign_id": "campaign_1", "updated_metrics": {"likes": 5, "comments": 2}}
{"post_id": "post_4", "campaign_id": "campaign_1", "updated_metrics": {"likes": 33, "comments": 8}}
{"post_id": "post_5", "campaign_id": "campaign_2", "updated_metrics": {"likes": 12, "comments": 15}}
{"post_id": "post_6", "campaign_id": "campaign_2", "updated_metrics": {"likes": 3, "comments": 1}}
```

Note that these 6 events span two unique campaigns and should therefore ideally create two separate
`post-metric-last-updated-X-minutes-ago` events. Remember, a sorted set stores unique strings, so we cannot just 
insert these JSON strings into the sorted set as is. If we did, they would be stored as 6 different entries in the set. 
We need to identify the `group key` which is a common form that all of these events can be converted to. The group key 
should remove all uniquely identifying 
information in the event so that the events have the same serialized value. In our example, the group key would be just
the `CampaignID` field:

```
{"campaign_id": "campaign_1"}
{"campaign_id": "campaign_2"}
```

But wait... We just lost a bunch of information in our events! That's right. I never said this compression was lossless!
In some cases this may be acceptable, you may be able to gather that information elsewhere or it may not be relevant for 
what you are trying to do on the subscriber side. 
In cases where you do need that information, we can store it separately in a database as you are inserting values into 
the sorted-set. When we query the sorted-set for events, we can "decompress" the event by enriching it with information
we stored in the database. Since we are already using Redis, lets use it to store this additional event information.

In our example, we need a list of metrics that changed so that we know which campaign-level metrics to compute.
We can easily keep track of the metrics that changed in a regular Redis set. When we query the sorted-set to get
the compressed event older than `X` we also grab the metrics that have changed from the regular set. We can then assemble
the `post-metric-last-updated-X-minutes-ago` event:


```
type PostMetricUpdatedEvent  struct {
	CampaignID string        `json:"campaign_id"`
	UpdatedMetrics []string  `json:"updated_metrics"`
}
```

Our service performing the computation can then listen for this event and query the database or service in order
to perform the aggregation. We can rest assured that we will compute the value at most once in `X` minutes since the
last time a post metric was updated.
