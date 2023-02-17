---
title: "Testing complex workflows in Go"
draft: false
date: 2022-10-01
categories: ["Golang"]
---

The standard library `testing` package in Go does many things well. It is simple to use and
executes fast and efficiently, even running tests in parallel and the caching results. However, many including myself,
have turned to supplemental packages to address some blind spots when writing tests:

- Test setup, teardown and grouping
- Assertions and output validation
- Mocking

I have found that these blind spots become particularly cumbersome when you have workflows that involve sophisticated fixture setup,
multiple edge cases, error handling, mocks, and complex outputs. In this article, I'm going to go through
a style of testing that helped me with many of these issues.

## Testify

One of the most popular third party testing packages is [stretchr/testify](https://github.com/stretchr/testify),
and for good reason. It boasts solutions to the major blind spots I've listed above by providing easy assertions,
mocking and test suite interfaces and functions. In particular, I find myself using `testify/suite` for complex
workflows because it provides better test setup, teardown and organization capabilities. If you aren't already familiar
with `testify/suite`, I would recommend you take a quick detour of the [docs](https://github.com/stretchr/testify#suite-package)
and [examples](https://github.com/stretchr/testify/blob/master/suite/suite_test.go) before reading on.


## Case study: LinkedIn post scraping
For this article I am going to go through an example of testing a stream processing application which calls the LinkedIn
APIs to get organization posts and their lifetime metrics. I am going to attempt to show you the tests without the
application code, because I do not believe showing the code brings much value. Just know that the code we are testing does
the following:

1. Calls the LinkedIn ListUGC endpoint to get a list of user generated content (posts) from the organization.
2. Calls the EntityShareStatistics endpoint to request the lifetime metrics for each post less than a week old.
3. Returns a list of the posts, with metrics (if they are retrievable).

## The test setup

I begin all my tests with the same layout: The `testify/suite` structs and methods, mocks and fixture setup.

```go

// Constants to improve readability 
const (
    Fail    = false
    Succeed = true
)

// Mocks is a collection of all the mocks used in the tests
type Mocks struct {
    LinkedinClient   mocks.LinkedinClient
}

// Fixtures is a grouping of entities interacted with in the tests
type Fixtures struct {
    input           *Input
}

// Expectations are a grouping of the results or expectations of the tests
type Expectations struct {
    Output *Output
    Error     error
}

// LinkedinCollectorTestSuite will test the collection of the LinkedIn post and metric collector
type LinkedinCollectorTestSuite struct {
    suite.Suite
    mocks      Mocks
    fix        Fixtures
    expect     Expectations
    collector  *Collector
}

// Before every test, setup new mocks, fixtures and expectations
func (s *LinkedinCollectorTestSuite) SetupTest() {
    s.mocks = Mocks{}
    s.fix = Fixtures{}
    s.expect = Expectations{}
}

func (s *LinkedinCollectorTestSuite) TearDownTest() {
    t := s.T()
    s.mocks.LinkedinClient.AssertExpectations(t)
}
```

There are a few things I want to highlight:

1. The `Mocks{}` structure is created with values, not pointers. This makes initializing all the mocks very easy because
   the `testify/mocks` do not need a constructor, their zero values are ready to use.
2. I keep mocks, fixtures and expectations in their own respective structures. This helps readability and also allows you
   to define methods on them for further customization.
3. I define a few constants such as `Succeed` and `Fail` for readability. This will become more clear later as we start to
   write the tests.
4. Mock, fixture and expectation setup are done in the `SetupTest()` so that they are run before each test, providing fresh
   values and no artifacts from previous runs.
5. The `TearDownTest()` method is used to assert the mock calls after each test.

Once we have our initial skeleton setup, we can start writing tests for our code flows. I always start off testing the
happy-path: the code flow where there are no errors and everything works as expected. The reason for this is two-fold:

1. It gives us a good context from which subsequent test cases can be built from. (Most test cases are just varying degrees
   in which the happy path becomes sad)
2. The happy path allows us to validate that the business logic is correct when things are working as expected.

To do this, we build all our fixtures and expectations based on this happy path in the `SetupTest()` method:

```go

type Input struct {
    linkedinPageID string	
}

type Output struct {
	Posts []*Post
}

// This would be a model defined by the application, but I am redefining it here for 
// clarity of reading the tests
type Post struct {
	ID           string
	Type         string
	CreatedDate  time.Time
	Metrics      map[string]float64
}

// Fixtures is a grouping of entities interacted with in the tests
type Fixtures struct {
	linkedinPageID    string
	linkedinAuthToken string
	textPost          *Post
	videoPost         *Post
    input             *Input
}

// Before every test, setup new mocks, fixtures and expectations
func (s *LinkedinCollectorTestSuite) SetupTest() {
	s.mocks = Mocks{}
	s.fix = Fixtures{
		linkedinPageID: "test_page_id",
		linkedinAuthToken: "mock_token",
		input: &Input{linkedinPageID: "test_page_id"},
	    textPost: &Post{
                        ID: "1",
                        Type: "TEXT",
                        CreatedDate: time.Now().AddDate(0, 0, -1), // 1 day old
		                Metrics: map[string]float64{"likes": 1, "shares": 1}}
	    videoPost: &Post{
		                ID: "2",
						Type: "VIDEO",
						CreatedDate: time.Now().AddDate(0, 0, -3), // 3 days old
                        Metrics: map[string]float64{"likes": 2, "shares": 2}}
	}
	
	s.expect = Expectations{
                        Output: &Output{Posts: []*Post{s.fix.textPost, s.fix.videoPost}}
    }
}
```

We also add a test case for the happy path:

```go
func (s *LinkedinCollectorTestSuite) HappyPath() {
    got, err := s.collector.Collect(s.fix.input)
    s.NoError(err)
    s.Equal(t.expect.Output, got)
}
```

## Mock Parameterization

Now our tests will not pass until we setup our mock calls. In the past, I have seen developers setup their mock calls
in each test, often applying the same copy-paste code for a majority of the mocks, and tweaking just one. **Do not do this**.
This leads to huge test files that are hard to refactor and tests that drown out the important aspects with irrelevant 
boilerplate. Instead, I strongly suggest having mock setup functions that can be parameterized to meet all the different 
demands of your individual tests. Here is one such example:

```go
func (s *LinkedinCollectorTestSuite) setupListUGCCall(succeed bool) {
	// mock.Anything is for the context.Context argument
	call := s.mocks.LinkedinClient.On("ListUGC", mock.Anything, s.fix.linkedinPageID, s.fix.linkedinAuthToken)
	if succeed {
		resp := &ListUGCResponse{
            Posts: []*Post{s.fix.textPost, s.fix.videoPost}
}
		call.Return(resp, nil)
		return
    }
	
	// Otherwise fail with an error and adjust expectations
	s.expect.Output = nil
	s.expect.Error = fmt.Error("failed to call ListUGC endpoint")
	call.Return(nil, s.expect.Error)
}
```

In the example above, we have added a single parameter, `succeed`, to alter the direction of the code flow. If `succeed`
is false, then the mock is setup to make the LinkedIn API call fail, and we adjust our expectations accordingly. 
This is perhaps the simplest mock parameterization you can do, but it gives you an idea the power of parameterization.
Testing the happy path and the code flow where the ListUGC endpoint fails becomes easy to implement and read:

```go
func (s *LinkedinCollectorTestSuite) HappyPath() {
	s.setupListUGCCall(Succeed)
    got, err := s.collector.Collect(s.fix.input)
    s.NoError(err)
    s.Equal(t.expect.Output, got)
}

func (s *LinkedinCollectorTestSuite) ListUGCFails() {
    s.setupListUGCCall(Fail)
    got, err := s.collector.Collect(s.fix.input)
    s.EqualError(err, "failed to call ListUGC endpoint")
    s.Nil(got)
}
```

In situations where the error is immediately returned up the stack, testing this code path is only really beneficial for improving
code coverage. Often times, you have more complicated error handling that you specifically want to test. This is where
mock parameterization really shines. 

The next mock call is for the EntityShareStatistics endpoint, which is called for each post and returns the post's
lifetime metrics. If the call to gather metrics fails, we want to carry on publishing the post without the metrics.
This is how the mock setup method looks:

```go
func (s *LinkedinCollectorTestSuite) setupEntityShareStatisticsCall(succeed bool, mockPost *Post) {
    // mock.Anything is for the context.Context argument
	call := s.mocks.LinkedinClient.On("EntityShareStatistics", mock.Anything, mockPost.ID, s.fix.linkedinAuthToken)
	if succeed {
		resp := &EntityShareStatisticsResponse{
			PostID: mockPost.ID,
            Metrics: mockPost.Metrics,
        }
		call.Return(resp, nil)
		return
    }
	
	// mockPost is referenced in the expectations, so modifying it here adjust the expectations
	// If we used a value instead of a pointer, we would need to modify the expectations directly.
	mockPost.Metrics = nil
	call.Return(nil, s.expect.Error)
}
```

and now our happy path becomes:

```go
func (s *LinkedinCollectorTestSuite) HappyPath() {
	s.setupListUGCCall(Succeed)
    s.setupEntityShareStatisticsCall(Succeed, s.fix.textPost)
    s.setupEntityShareStatisticsCall(Succeed, s.fix.videoPost)
    got, err := s.collector.Collect(s.fix.input)
    s.NoError(err)
    s.Equal(t.expect.Output, got)
}
```

The failure path is nearly the same, but instead we pass `Fail` to one of the `setupEntityShareStatisticsCall`:

```go
func (s *LinkedinCollectorTestSuite) EntityShareStatisticsFailsForOnePost() {
   s.setupListUGCCall(Succeed)
   s.setupEntityShareStatisticsCall(Fail, s.fix.textPost)
   s.setupEntityShareStatisticsCall(Succeed, s.fix.videoPost)
   got, err := s.collector.Collect(s.fix.input)
   s.NoError(err)
   s.Equal(t.expect.Output, got)
}
```

## Testing Edge Cases

We have an edge case in the `EntityShareStatistics` endpoint. The endpoint only lets you gather metrics for posts that are less 
than a certain age (for simplicity, let's say 1 week). Calling the endpoint on a post older than a week would return an 
error and consume rate limits. To avoid issues, we want to skip these posts with a simple post age check. 
This is what a test for this edge case would look like:


```go
func (s *LinkedinCollectorTestSuite) SkipTooOldPost() {
    // older than one week --> No call to EntityShareStatistics endpoint
	s.fix.textPost.CreatedDate = time.Now().AddDate(0, 0, -8)
	// Since we do not call the EntityShareStatistics endpoint for this post, it will have no metrics
	s.fix.textPost.Metrics = nil
	
	s.setupListUGCCall(Succeed)
    s.setupEntityShareStatisticsCall(Succeed, s.fix.videoPost)
    got, err := s.collector.Collect(s.fix.input)
    s.NoError(err)
    s.Equal(t.expect.Output, got)
}
```

As you can see, we simply mutate the fixtures before the test runs and adjust the mock calls accordingly. For the mocks,
all we needed to do was remove the `EntityShareStatistics` call for the `textPost`, which we made older than one week.
Since the expectations uses a pointer to the post fixture, we just need to modify the fixture itself. If we chose to use
a value instead of a pointer, then we would also need to update the expectations directly.

Further flexibility of the mock parameterization can be attained by using 
[functional options](https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis). Functional options
becomes more useful when your mock setup calls start having too many parameters and thus start having mulitple code paths.
**It is important to keep the mock setup calls simple and easy to read**.

## Alternatives 

### Table tests

One testing paradigm that became popular in the Go community are [table tests](https://dave.cheney.net/2019/05/07/prefer-table-driven-tests).
Table tests are great for very simple, low complexity code, however they come with the tradeoff of reduced readability. 
Table tests excel in situations where there is no setup code, state or mocks/integrations and for when there are
lots of edge cases based solely on varying inputs. In my opinion, they are not great for testing complex workflows.

### Behavior Driven Testing (DDD)

[Behavior Driven Testing](https://en.wikipedia.org/wiki/Behavior-driven_development) is an evolution of 
[Test Driven Development (TDD)](https://en.wikipedia.org/wiki/Test-driven_development) where test cases and expectations 
are written in a natural language, such as English. It allows for business people
to write test cases and developers implement them. I am a huge fan of Behavior Driven Testing as it leads to higher 
quality tests, coverage and a better understanding between both development and business teams.

[Go Convey](https://github.com/smartystreets/goconvey) and [Ginkgo](https://onsi.github.io/ginkgo/#top) are two popular
BDD style frameworks for the Go language. However, they do have a steeper learning curve than `testify`. 
These two libraries have a unique test execution strategy where the tests and sub-tests are executed by traversing
the test tree in depth-first approach. Understanding this becomes even more important when you have tests that communicate
with external dependencies like databases. Each iteration runs from the root of the tree down to a leaf, creating its
own scope that is independent to other iterations. This execution strategy is very powerful because it eliminates a 
lot of fixture generation boilerplate, allowing you to test all edge cases efficiently and effectively.

## Conclusion

There are many different styles and testing frameworks available in Go. In this article I've talked about my own style
that has serviced me well for testing complex workflows. If you decide to try it, I would love to hear your feedback.