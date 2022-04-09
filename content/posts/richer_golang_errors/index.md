---
title: "Advanced Go Error Handling Made Simple"
draft: false
date: 2022-03-22
categories: ["Golang"]
---

<div style="text-align:center">

<img alt="SimpleError" src="https://blog.lobocv.com/posts/richer_golang_errors/gopher.svg"/>

</div>


One of the most notorious design decisions of Go is how it approaches error handling. Go handles errors explicitly by
returning them as values from any function that can possibly raise an error. To many, this way of error 
handling is uncomfortable at first. The tediousness of having every function not only return an optional error but also check the 
returned error from every function seemed to be too tedious.

After working with the language for several years, I have come to love the way Go approaches error handling. Requiring the programmer
explicitly think of all error paths and forcing them to handle them immediately leads to higher quality code and a 
deeper understanding of how their software can react. There are several high quality articles on the practical usages of 
standard library errors in Go, so I will just briefly touch upon the main concepts laid out in order to build some
foundation for what is next. 

In Go, errors are interfaces with a single method:

```go
type error interface {
	Error() string
}
```

The standard library provides an easy way to create simple errors using the `fmt` package:

```go
userID := "23"
err := fmt.Errorf("user with id = %s already exists", userID)
// "user with id 23 already exists"
```

You can also "wrap" an existing errors with additional information. The underlying, or "wrapped" error, can still be
extracted using the [`errors.As()`](https://pkg.go.dev/errors#As) or [`errors.Is()`](https://pkg.go.dev/errors#Is) 
functions. Note the use of `%w` instead of `%s` to indicate wrapping:

```go
errWrapped := fmt.Errorf("failed to create user: %w", err)
// "failed to create user: user with id 23 already exists"
```


Both these methods return a very primitive implementation of the `error` interface, which essentially only contains a 
string and the wrapped error (if it exists). This is in-line with Go's light-weight, less-is-more philosophy. On the
other hand, there is a lot lacking from these basic errors. Fortunately, because `error` is an interface, we are free to 
define our own implementation. 

In this article, we will introduce a new error implementation from the [simplerr](https://github.com/lobocv/simplerr) package,
with a main goal of reducing boilerplate and increasing code legibility for practical and common error handling scenarios. 
The primary design decision of the package was to have error handling logic confined to middleware layers and to propagate 
any input parameters for the logic on the error itself.

But before we jump into it, I want to talk about what errors are, are not, and some use-cases in which the standard
library implementation is insufficient.


### Errors are meant to be handled

The main purpose of errors are to convey when something has gone wrong and to provide enough information so
that the software or the client can handle it. There are an infinite number of ways software can error, so to
assist with error handling on the client side, specifications such as HTTP and gRPC define categories of 
errors. Developers using these protocols need to translate errors raised in the application to the specification's 
error codes. 


**Table 1: Table of some HTTP status codes and equivalent gRPC codes. [[Reference]](https://github.com/grpc/grpc/blob/master/doc/http-grpc-status-mapping.md)**

| HTTP Status Code        | gRPC Status Code    |
|------------------------|---------------------|
| 400 Bad Request         | 13 Internal         |
| 401 Unauthorized        | 16 Unauthenticated  |
| 403 Forbidden	          | 7 Permission Denied |
| 404 Not Found	          | 12 Unimplemented    |
| 429 Too Many Requests   | 14 Unavailable      |
| 502 Bad Gateway	      | 14 Unavailable      |
| 503 Service Unavailable | 14 Unavailable      |
| 504 Gateway Timeout	  | 14 Unavailable      |
| All other codes	      | 2 Unknown           |

Often times I see this translation being done manually over each segment of code that returns an error in the API layer.


> **Problem 1: Error translation to HTTP/gRPC specifications must be done manually for every function that returns an error.**


### Contextual Errors and Structured Loggers

Structured logging is one of the best ways to build observability into your system. By attaching key-value pairs to log
statements, one can more readily parse, filter and query specific log messages based on the context of the code at the time.
Observability stacks such as [ELK](https://www.elastic.co/elastic-stack/) or [Sumologic](https://www.sumologic.com/) can 
provide a powerful way to aggregate, index and search through millions of logs messages.

**Figure 1: Example of a structured log in JSON formatting.**

```json
{
  "level":"info",
  "time":"2022-02-19T10:16:42Z",
  "caller":"eventgenerator/processor.go:90",
  "msg":"Generating event", 
  "shard":1,
  "operation_type":"update",
  "cluster_time":"2022-02-19T10:16:42Z",
  "stream_lag":"561.806189ms",
  "content_id":"6INvoQTXzZM",
  "event_name":"content-modified"
}
```

In the majority of cases, you should be logging errors and providing as much contextual information as possible
in order to make debugging as smooth as possible[1]. The standard library errors do not provide a way to
pass this contextual information in a way that can easily be extracted and passed to structured loggers.
This often results in errors being logged manually at the return-site of the error in order to transfer context to the logs.
This leads to bloated error handling logic which distracts from the intent of the code. 

> **Problem 2: Logging of errors is often a manual process due to a disjointed interaction between error and logging packages.**

If we were able to attach key-value information to the error, we may be able to automate the logging of errors in a middleware
layer. Unfortunately, the standard library `http` package does not have an `error` return argument to HTTP handlers, which
makes writing error logging middleware difficult. The gRPC framework, on the other hand, does return an error and makes this possible.

### Decoupling errors from different layers is tedious

In order to decouple layers of in our software, we need to prevent leaking of implementation details
via errors that need to be detected in above layers. For example, in order to detect that a unique constraint has been 
violated when using MongoDB in the persistence layer, we need to detect a particular error raised by the mongo library:

```go
// IsDuplicateKeyError checks that the error is a mongo duplicate key error
func IsDuplicateKeyError(err error) bool {
	const mongoDuplicateKeyErrorCode = 11000
	
	if mongoErr, ok := err.(mongo.WriteException); ok {
		for _, writeErr := range mongoErr.WriteErrors {
			if writeErr.Code == mongoDuplicateKeyErrorCode {
				return true
			}
		}
	}
	return false
}
```

While this function is fine to be used inside the persistence layer, we should not use it inside the application layer 
with which it interfaces due to the direct reference to the `mongo` package. One method of abstracting the `mongo` package
is to have the persistence layer define it's own `DuplicateKeyError` that is raised instead whenever the `mongo` library returns an 
error from writing to a duplicate key. This allows us to change the storage library used in the persistence layer away
from MongoDB without breaking changing any other software layers.

```go

// Define an error in the persistence layer package that we can return instead of the mongo.WriteException
type UserAlreadyExistsError struct {
    email string
}

// Error implements the error interface
type (e *UserAlreadyExistsError) Error() string {
    return fmt.Sprintf("user already exists with email '%s'", e.email)   
}

// Create a user by it's email. The email is the unique key for looking up users.
func (s *Database) CreateUser(ctx context.Context, email string) (string, error) {
    user := User{email: email}
    result, err := s.mongodb.InsertOne(ctx, user)
    
    // Check if the error was from mongo.WriteException and return UserAlreadyExistsError instead
    if IsDuplicateKeyError(err) {
        return &UserAlreadyExistsError{email: email}
    }
    if err != nil {
        return "", fmt.Errorf("failed to create user: %w", err)
    }
    
    return result.Hex(), nil
}

```

While this is not a huge amount of added code, this work compounds if you have several separate persistence packages or
different data storage libraries that each need their own abstracting. To make things worse, if you are using a transport
layer, you will need to do the same detection and translation yet again in order to return the proper error statuses 
defined in the transport specification.

```go
func (s *Server) CreateUser(resp http.ResponseWriter, req *http.Request) {
	
    // extract email from request...
	
    err := s.db.CreateUser(email)
	if err != nil {
	    statusCode := http.StatusInternalServerError
		
		// If the error was from an UserAlreadyExistsError, change the status code to BadRequest
		var alreadyExistsErr storage.UserAlreadyExistsError
	    if errors.As(err, &alreadyExistsErr) {
	        statusCode = http.StatusBadRequest
	    }

        resp.WriteHeader(statusCode)
	    return
    }

    resp.WriteHeader(http.StatusOK)
}
```

If we take a deeper look into the duplicate key error, we may be 
able to capture the essence of what this error signifies and fit it into a category much like the ones used by gRPC and
HTTP specifications.


> **Problem 3: Abstracting and propagating errors from third party dependencies is manually intensive.**


### Not all errors are bad

In Go, errors are sometimes intentionally returned as a way of signaling a certain code path or expected state is reached.
For example, the `io` package defines an `io.EOF` sentinel error to signal that the reader has reached the end of a byte stream.
In this case, `io.EOF` isn't a true error, but instead a convenient way to indicate a special case in the programming flow.
Let's call these types of errors **benign errors**.

Benign errors can often be difficult to work with. Let's look at an example of an API which returns some resource,
such as a `Settings` object for a particular optional feature.
Callers of this API can look for response codes `404` (HTTP) or `5` (gRPC) to determine if the user has enabled this 
feature.
On the server side, the SQL-based storage layer may return a `sql.ErrNoRows` error for such calls. If we were to log each of
these errors at the `ERROR` level we would be flooding the logs with benign errors. In this situation, the real error 
is on the client side, depending on whether the caller is expecting the user to have the feature or not. The client may be simply checking
whether the user has the feature enabled, in which case, it is also a `benign error` on the caller side. On the server, we should be able to 
detect these kind of errors and choose not to log them as errors, yet still return them as errors to the client. This 
becomes particularly difficult when error translation and logging are done within middleware.


> **Problem 4: Handling of benign errors on the server side cannot be done from within middleware.**

### No control over how errors are retried 

Some errors are transient in nature. A hiccup in the network or temporarily unavailable service may cause a request, that 
failed a moment ago, to succeed by just retrying the request. In these cases, it can be useful to retry the request with
an exponential backoff, in hopes of eventually succeeding. However, not all errors should be retried[3] and there is not
a standard way to convey this information to upstream callers. 

> **Problem 5: Standard library errors have no way to convey additional information on how to handle the error.**

## Designing a Better Error

Given that the `error` interface is so small, we can implement our own implementation that to alleviate the
aforementioned problems. The rest of the article will be used to introduce you to the [simplerr](https://github.com/lobocv/simplerr)
package and show you how it can help you implement better error handling.

Simplerr defines a single error implementation, called the `SimpleError`. The SimpleError has several traits that make
it very flexible for describing and handling errors. Let's look at how the SimpleError solves each of the problems previously 
outlined.


##### Problem 1: Error translation to HTTP/gRPC specifications must be done manually for every function that returns an error.

Simplerr defines a set of standard error codes for common errors that occur in software. Codes such as `NotFound` or 
`PermissionDenied` are self explanatory and have analogs in HTTP and gRPC specifications. If the list of standard codes does
not fit your error, you can globally register your own error codes with the package. Errors can then be handled by their error 
code rather than type or value. This allows us to label and detect errors in a more human-readable and dependency-agnostic way.

```go
userID := 123
companyID := 456
err := simplerr.New("user %d does not exist in company %d", userID, companyID).
	Code(CodeNotFound)
```


These error codes can also be translated directly to HTTP / gRPC specifications 
(see [ecosystem/http](https://github.com/lobocv/simplerr/ecosystem/http) and 
[ecosystem/grpc](https://github.com/lobocv/simplerr/ecosystem/grpc) packages). In the case of gRPC, an interceptor (middleware)
allows us to handle this translation automatically via an interceptor.

```go
func main() {
    // Get the default mapping provided by simplerr
    m := simplerr.DefaultMapping()
    // Add another mapping from simplerr code to gRPC code
    m[simplerr.CodeMalformedRequest] = codes.InvalidArgument
    // Create the interceptor by providing the mapping
    interceptor := simplerr.TranslateErrorCode(m)
    // Apply the interceptor to the gRPC server...
}
```

##### Problem 2: Logging of errors is often a manual process due to a disjointed interaction between error and logging packages.

With `SimpleError`, you can attach auxiliary information to the error as key-value pairs, using the 
[`Aux()`](https://pkg.go.dev/github.com/lobocv/simplerr#SimpleError.Aux) and 
[`AuxMap()`](https://pkg.go.dev/github.com/lobocv/simplerr#SimpleError.AuxMap) methods.
These fields can be extracted and used with structured loggers in a middleware layer. This eliminates the need to choose
between manually logging errors at the point at which they are raised or surrendering structured logging fields.

```go
userID := 123
companyID := 456
err := simplerr.New("user %d does not exist in company %d", userID, companyID).
	Code(CodeNotFound).
	Aux("user_id", userID, "company_id", companyID)
```

Retrieving the fields should be done with the [`ExtractAuxiliary()`](https://pkg.go.dev/github.com/lobocv/simplerr#ExtractAuxiliary)
function so that auxiliary fields from each wrapped error in the chain are retrieved as well.

`SimpleError` does not have logging integration due to the difficulty of defining a logging interface that works well 
with the variety of loggers out there. Although adapters could always be written to satisfy the interface, it would 
involve extra steps and does not follow the philosophy of "keeping it simple". Fortunately, integrating logging (and more
particularly, structured logging) is simple with the use of custom attributes.

Much like the `context` package, `SimpleError` allows you to attach arbitrary key-value information onto the error. 
We can use this feature to attach the structured logger at the site at which the error is raised, capturing all the 
scoped logging fields with it.

The following is an example of attaching a [zap logger](https://github.com/uber-go/zap) to a raised error. 

```go

// Define a custom type so we don't get naming collisions for value == 1
type ErrorAttribute int

// Define a specific key for the attribute
const LoggerAttr = ErrorAttribute(1)

// Attach the `LoggerAttr` attribute on the error
serr := simplerr.New("user with that email already exists").
	Code(CodeConstraintViolated).
	Attr(LoggerAttr, logger)
```

We can then write middleware which extracts this logger (if it exists) from the error to log the error. 
 
```go
func ErrorHandlingMiddleware(....) (...) {
    if err != nil {
        // Get the logger by using the LoggerAttr key
        scopedLogger, ok = simplerr.GetAttribute(err, LoggerAttr).(*zap.Logger)
        if ok {
            auxFields := simplerr.ExtractAuxiliary(err)
            // log the error with the scoped logger and the auxiliary fields
            scopedLogger.Error(...)
        } else {
            // log the error with the standard logger
            log.Error(...)     
        }
    }
}
```

##### Problem 3: Abstracting and propagating errors from third party dependencies is manually intensive.

By using error codes rather than sentinel errors or custom error types, we can greatly simplify how we abstract errors
from third parties. We can detect and convert errors, as we would traditionally do, but instead of defining a custom error,
we return a `SimpleError`.


```go
// IsDuplicateKeyError checks that the error is a mongo duplicate key error
func IsDuplicateKeyError(err error) error {
	const mongoDuplicateKeyErrorCode = 11000
	
	if mongoErr, ok := err.(mongo.WriteException); ok {
		for _, writeErr := range mongoErr.WriteErrors {
			if writeErr.Code == mongoDuplicateKeyErrorCode {
				return simplerr.Wrap(err).Code(simplerr.CodeConstraintViolated)
			}
		}
	}
	return nil
}
```

The previous example of creating a user then looks like this, allowing us to use the 
[`ecosystem/http`]((https://github.com/lobocv/simplerr/tree/master/ecosystem/http)) package to convert
errors directly to status codes on the `*http.Response` object.

```go
// Create a user by it's email. The email is the unique key for looking up users.
func (s *Database) CreateUser(ctx context.Context, email string) (string, error) {
    user := User{email: email}
    result, err := s.mongodb.InsertOne(ctx, user)
    
    // Check if the error was from mongo.WriteException and return the SimpleError with an attached message
    if serr := IsDuplicateKeyError(err); serr != nil {
        return fmt.Errorf("user already exists with email '%s': %w", e.email, err))
    }
    if err != nil {
        return "", fmt.Errorf("failed to create user: %w", err)
    }
    
    return result.Hex(), nil
}
```

```go
func (s *Server) CreateUser(resp http.ResponseWriter, req *http.Request) {
	
    // extract email from request...
	
    err := s.db.CreateUser(email)
	if err != nil {
		// SetStatus will attempt to translate the SimpleError to a status code on the *http.Response, if 
		// it cannot find a translation, it defaults to 500 (InternalServerError)
        simplehttp.SetStatus(resp, err)
	    return
    }

    resp.WriteHeader(http.StatusOK)
}
```

An analogous approach can be done for gRPC servers with the 
[`ecosystem/grpc`]((https://github.com/lobocv/simplerr/tree/master/ecosystem/grpcc)) package. 
This time it is even easier to convert SimpleErrors to response codes through an interceptor (middleware).
In both http and gRPC, the error translation mapping can be customized.

##### Problem 4: Handling of benign errors on the server side cannot be done from within middleware.

`SimpleErrors` can be marked as `silent` or `benign` so that logging middleware can handle them differently. Benign
errors can optionally add a reason why they are considered benign. This information is useful to have in the log when it
comes time to debug. How you decide to handle silent or benign errors is ultimately up to you, however it is recommended that silent errors
not be logged at all, and benign errors be logged at a less severe level such as DEBUG or INFO.

```go
if err != nil {
    // Check if the errror is a SimpleError
    if serr := simplerr.As(err); serr != nil {
        
        if serr.IsSilent() {
            // do not log silent errors
            return
        }
        
        // if the error is benign, log as INFO
        if reason, benign := serr.IsBenign(); benign {
            log.Info(....)
            return
        }
    }
    
    // log error at ERROR level
    log.Error(....)
}
```

##### Problem 5: Standard library errors have no way to convey additional information on how to handle the error

Assigning additional attributes to errors can be done in a similar way to the `context` package and the
`context.WithValues()` function. The following is an example of attaching an attribute to an error which
indicates that this error should not be retried.

```go
// Define a custom type so we don't get naming collisions for value == 1
type ErrorAttribute int

// Define a specific key for the attribute
const NotRetryable = ErrorAttribute(1)

// Attach the `NotRetryable` attribute on the error
serr := simplerr.New("user with that email already exists").
	Code(CodeConstraintViolated).
	Attr(NotRetryable, true)

// Get the value of the NotRetryable attribute
doNotRetry := simplerr.GetAttribute(err, NotRetryable).(bool)
// doNotRetry == true
```


## Conclusion

The `error` interface in Go allows us to define alternative implementations for errors. While the standard library errors
are sufficient, they can be improved to better fit our workflow and style. The [`Simplerr`](https://github.com/lobocv/simplerr) package is just one way to 
implement a custom error. It solves many of the issues that I had encountered while developing Go services and APIs. 
Hopefully it can help you too.


### Footnotes
**[1]** Be careful who will be receiving the errors you are returning. If it is just software that you own, you can be
more transparent about the  root cause of the issue. However, if you are exposing your API publicly, you do not want
to give a potentially malicious user implementation details of your system.

**[2]** The `error` interface was intentionally kept small in order to be easily adopted. Forcing thing such as 
key-value pairs into the error would be enforcing too much on the user who may not care about structured logging 
(for example, CLI developers). 

**[3]** Not all errors should be retried. Make sure your request is idempotent so that you are not causing more problems
for yourself.
