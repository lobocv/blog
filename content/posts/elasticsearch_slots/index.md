---
title: "Defusing an ElasticSearch Mapping Explosion with Slots"
draft: false
date: 2021-12-12
categories: ["Databases"]
---
<img alt="Diffusing A Mapping Explosion" src="https://blog.lobocv.com/posts/elasticsearch_slots/img.png"/>

ElasticSearch (and similarly [OpenSearch](https://opensearch.org/)[1]) is a popular OLAP database that allows you to quickly search and aggregate your 
data in a rich and powerful way. It is a mature storage technology build on top of [Apache Lucene](https://lucene.apache.org/) that has been used to back
many online storefronts and analytical processing products around the world.
Under the hood, ElasticSearch uses Lucene to index each field in the document so that queries can be executed efficiently. 

In order to provide rich searching capabilities, ElasticSearch creates indices for each field it receives. The type of index
created is determined by the data type of the field. Possible data types include numeric types such as `integer`, `float`
and `double` as well as two string data types, `keyword` and `text`. The list of all indexed fields (and how they are indexed)
are stored in what is called an [index mapping](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html). 
By default, ElasticSearch will create a mapping entry when a new field is encountered by deducing it's data type[2].
This is called dynamic mapping. 

The problem with dynamic mapping is that once ElasticSearch introduces a field to the mapping, it can 
[never be removed](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/indices-delete-mapping.html). The index mapping
also consumes cluster memory and must be replicated to all nodes. If you are not careful, leaving dynamic mapping enabled
can lead to very large index mappings and slow down your cluster. This is called a `mapping explosion`. For this reason,
it is recommended to disable dynamic mapping and enable it sparingly only for objects that you can trust have a finite number
of fields[3].

In many cases this is not an issue and it is not restrictive to disable dynamic mapping. However, in some cases a user
may determine the name of a field. In such situations, one must come up with a strategy to mitigate the 
risk of an eventual mapping explosion. The rest of this article talks about how we mitigated a mapping explosion in
HootSuite's analytics products.

## The problem context

At Hootsuite, we use ElasticSearch to store social media content and their associated metrics such as `likes`, `impressions`
`shares` and `comments`.
With ElasticSearch, customers can search for content across all their social networks in a multitude of ways. They can
also aggregate metric values from their content over a time range to give them a view of their social marketing performance.
These metrics are retrieved from the social network APIs and stored in separate fields in ElasticSearch under a `metrics` object.
These fields have the same name as the metric and are common among all users of the social network. 
Since there are a finite number of metrics, there is no risk of a mapping explosion.
However, we also collect metrics from offsite attributions such as [Google](https://analytics.google.com/analytics/web/provision/#/provision)
and [Adobe Analytics](https://business.adobe.com/ca/products/analytics/adobe-analytics.html). 
On these platforms, users can name and define their own metrics. These are the metrics we need to be careful about. 
Each customer now has the ability to permanently increase our mapping size by creating a unique metric name. The problem 
is even more serious when you consider that these mapping entries will be around long after a customer has stopped using that metric.

Disabling these fields in the mapping is not an option. We needed to devise a way to still provide the search and aggregation 
functionality that is so critical to our product functionality, yet also have a stable long tem solution. To overcome
this, we came up with a system we called `Slots`.

## Defusing a mapping explosion

With the slots approach, we gain control of unbounded mapping growth by predefining a fixed number of fields (the slots) and translating
them in the application code to the user-defined values. We call the application-level translation from metric to slot the
`slot-mapping`. 

<img alt="ElasticSearch Slots" src="https://blog.lobocv.com/posts/elasticsearch_slots/es_slots.svg"/>

Each user will have their own slot-mapping, meaning that the metric referred to by each slot will be different for each 
user. The number of slots we need to allocate needs to be, at a minimum, equal to the amount that the customer with the 
highest number of custom-named metrics has[4]. From looking at our own data, the customer with the largest
amount of custom metrics had about 200 metrics. To be safe, we allocated 1000 slots.

## Trade offs

The slots approach is not without it own caveats. For one, it makes debugging and reading data more difficult. Now if we
inspect our data with third party tools such as [Kibana](https://www.elastic.co/kibana/), rather than seeing a field 
named `custom_metric_c`, we see `slot_3`. We need to refer back to the slot-mapping to determine which slot refers to 
the metric we are looking for.

Second, we must be careful that there are no requests for data that combine documents that use different slot-mappings.
You cannot aggregate `slot_2` across data from two different customers because the metric `slot_2` refers to will be different.
Luckily, aggregating across customers is not a valid business use-case and in fact goes again our multi-tenant principles.

Third, a customer may eventually hit their 1000 slot limit by renaming or adding new metrics that they use temporarily.
This has yet to happen but there are a few avenues for when it possibly does. We can reclaim some of the slots that are no longer
in use by going through data and removing the values from documents. Alternatively, we can simply increase the maximum 
slots.

## Defining the slot mapping

Each metric, whether it be from the social network or user defined, has a unique ID and some metadata associated with it
called the `Metric Definition`. At first it was tempting to store the slot number on the metric definition itself, however
we decided against it because slots are an implementation detail of the fact that we use ElasticSearch as a storage backend.
By exposing the slots outside of the service performing the translation to/from metric name to slot, we are weakening our 
abstraction.

Instead, we had the services that write to ElasticSearch each define their own slot-mappings. The slot mapping is defined the first 
time the service writes the metric to ElasticSearch. The flow requires us to keep a counter for the current number of slots for a user
and also the relationship between slot and metric name.

**Table: slot_counters**
| user_id 	 | n_slots 	 | 
|-----------|-----------|
| 1       	 | 2       	 |
| 2       	 | 4       	 |
| 3       	 | 0       	 |

**Table 1: The slot_counters table keeps track of the number of slots each user has used.**

**Table: slot_mappings**
| user_id 	| slot 	| metric            	|
|---------	|------	|-------------------	|
| 1       	| 0    	| visits            	|
| 1       	| 1    	| bounces           	|
| 2       	| 0    	| website_visits    	|
| 2       	| 1    	| website_pageviews 	|
| 2       	| 2    	| ecommerce_revenue 	|
| 2       	| 3    	| goal_values       	|

**Table 2: The slot_mappings table contains the relationships between slot and metric for each user. It has a unique
constraint on combinations of (user_id, slot).**

When a new metric is written, the counter is incremented and a new slot_mapping row is written. The slot_mapping table 
must also have a unique compound index on the `user_id` and `slot` columns. This unique index prevents
potential race conditions from multiple API requests trying to grab the next slot number at the same time. In the case of a race condition, 
one of the attempts to write to the slot_mapping table will fail on the unique-constraint and we can roll back the transaction and
simply retry again.  


Before writing to ElasticSearch, all metric names are converted to their slot numbers. When reading or aggregating metrics,
the slot names retrieved from ElasticSearch are translated back to the original metric names with the same slot_mapping table.
This whole process is completely transparent to the user of the API.

A small LRU caching layer is added around the metric slot-mapping values to reduce the number of times we need to go
to the database. Since these values are static and small, this ends up working very well.

## Conclusion

ElasticSearch / OpenSearch works well for indexing complex data schemas but has limitations when the the number of fields
is unbounded. Using application-level translation with the `Slots` approach, we can multiplex a fixed number of fields to
represent a larger number of fields and prevent a mapping explosion. The trade off is an overall increase in complexity
and reduction to the ease of debugging. The performance impact of adding an additional translation layer is negligible 
with the help of an LRU cache. 


### Footnotes
**[1]** In 2021, Elastic.co, the company that owns the license to ElasticSearch, changed their license to be more restrictive
and in conflict of open source values. In response, Amazon created a fork of ElasticSearch 7.10.2 named OpenSearch which
continues the Apache 2.0 license.

**[2]** ElasticSearch prevents you from shooting yourself in the foot too much by setting an 
[upper limit](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-settings-limit.html) on the number of
fields in a mapping. As of writing this, the default is 1000. This limit can be increased at any time.

**[3]** Dynamic mapping has another problem, it will set the field settings to general purpose presets. If you want
more control of your fields, such as defining a 
[custom analyzer](https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-custom-analyzer.html),
you should define the field mappings explicitly.

**[4]** Generally speaking, having hundreds or even thousands of fields in an ElasticSearch mapping is
not as much of an issue as the unbounded growth of the mapping.
