---
title: "Unit testing complex workflows in Go"
draft: true
categories: ["Golang"]
---

The standard library `testing` package in Go does many things well. It is simple to use and
executes fast and efficiently, even running tests in parallel and the caching results. However, many including myself,
have turned to supplemental packages to address some blind spots when writing tests: 

- Test setup, teardown and grouping
- Assertions and output validation
- Mocking

These blind spots become particularly cumbersome when you workflows that involve sophisticated fixture setup, 
multiple edge cases and error handling and mocks, and complex outputs. In this article, I'm going to go through
a style of testing that helped me with many of these issues. 

## Testify

One of the most popular third party testing packages is [stretchr/testify](https://github.com/stretchr/testify), 
and for good reason. It boasts solutions to the major blind spots I've listed above by providing easy assertions,
mocking and test suite interfaces and functions. In particular, I find myself using `testify/suite` for complex 
workflows because it provides better test setup, teardown and organization capabilities. If you aren't already familiar 
with `testify/suite`, I would recommend you take a quick detour of the [docs](https://github.com/stretchr/testify#suite-package)
and [examples](https://github.com/stretchr/testify/blob/master/suite/suite_test.go) before reading on.


## Case study: LinkedIn organizational post scraping
For this article I am going to go through an example of testing a stream processing application which calls the LinkedIn 
APIs to get organization posts and their lifetime metrics. The code being tested will focus on the business logic and
will omit plumbing from the stream processing framework. Like many components that need testing, the stream processor accepts an 
`Input` and returns an `Output, error`. In between it does the following:

1. Gets the user's LinkedIn page information such as page ID and authorization token to make API requests.
2. Calls the LinkedIn ListUGC endpoint to get a list of user generated content (posts) from the organization.
3. Request the lifetime metrics for each post

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
	ConnectionStorer mocks.ConnectionStorer
	LinkedinClient   mocks.LinkedinClient
}

// Fixtures is a grouping of entities interacted with in the tests
type Fixtures struct {
    input           *Input
}

// Expectations are a grouping of the results or expectations of the tests
type Expectations struct {
	output *Output
	err     error
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
	s.
    s.mocks.ConnectionStorer.AssertExpectations(t)
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

Once we have our initial scaffolding setup, we can start writing tests for our code flows. We always start off testing our 
happy-path: the code flow where there are no errors and everything works as expected. The reason for this is two-fold:

1. It gives us a good context from which subsequent test cases can be built from. (Most test cases are just varying degrees 
in which the happy path becomes sad)
2. The happy path allows us to validate that the business logic is correct when things are working as expected.

To do this, we build all our fixtures and expectations based on this happy path in the `SetupTest()` method. 
We also add a test case for the happy path:

```go
func (s *LinkedinCollectorTestSuite) HappyPath() {
    got, err := s.collector.Collect(s.fix.input)
    s.NoError(err)
    s.Equal(t.expect.Output, got)
}
```


