---
title: "why you shouldn't use domain models in API signatures"
draft: true
categories: ["Decoupling", "Design Patterns", "Golang"]
---

So you're writing some CRUD endpoints for your web application and you want to use a 
layered architecture to keep this clean and decoupled. You decide to separate the 
storage implementation from your API layer by creating two separate packages, an `api` 
package for your REST endpoints and a `storage` package for your database code.

Lets add some more context here. Say you are creating a new social media platform, `Blabber`
where you can share your thoughts about the world. The platform shares this post with the world
and lets people like, comment and share your post. Your API may have an endpoint to create a post:

`POST https://blabber.com/post`

In the body of the request we need to pass the follow information:  

```
{
  "user_id": "qwe123",
  "body": "Hey! Checkout this cool blog!",
  "attached_url": "https://blog.lobocv.com"
}
```

In our API we have a model for a `Post`. This is the model that is returned whenever
we query for posts:

```
type Post struct {
	ID string
	UserID string
	Body string
	AttachedURL string
	CreatedDate time.Time
}
```

Notice that in our database model for the `Post`, we also store the date at which
the `Post` was created under `CreatedDate`.

Lets write a method in our storage layer to create the `Post` in our Mongo database:

```
func (db *Database) CreatePost(ctx context.Context, r *Post) (string, error) {
    insertOneResult, err := db.mongo.InsertOne(ctx, r)
    if err != nil {
    	return "", err
    }
    return insertOneResult.InsertedID.(string)
}
```

I've seen this sort of method signature quite often. In this method, we pass the entire `Post` object,
leaving the body of the function to simply insert it into the database and return the auto-generated database ID.
This works, right? Do you see any issues?

## Separation of Concerns
What we've done here is we have leaked our storage implementation outside of our storage package 
and into our `api` package. Our API package is now responsible for creating the `Post` 
object as it is represented in the database. It has full control on what goes into the database.

In this particular example, two things can go wrong here:
1. A unexpected ID value can be passed on the `Post` causing data integrity issues or duplicate key errors.
2. A non-now CurrentDate value can be passed.

## Parameter Structs
Both of these scenarios can be avoided if we decouple our model from the storage API signature:

```
type CreatePostParams struct {
    UserID string
    Body string
    AttachedURL *url.URL
}

func (db *Database) CreatePost(ctx context.Context, r *CreatePostParams) (string, error) {
	p := Post{
        UserID: r.UserID,
        Body: r.Body,
        AttachedURL: r.URL.String(),
        CreatedDate time.Now()	
    }
    insertOneResult, err := db.mongo.InsertOne(ctx, p)
    if err != nil {
    	return "", err
    }
    return insertOneResult.InsertedID.(string)
}
```

As you can see here, the `Post` is now created inside the `CreatePost()` method using data from `CreatePostParams`.
Adding the `CreatePostParams` decouples our persistence model from the storage API, giving us complete flexibility to
change one or the other independently and without consequences.

Now you may be thinking, why we can't just add validation on the `Post{}` object being passed in? And you would be right.
We very well could have added checks for the `ID` field being empty or the `CreatedDate` being today's date, but in my
opinion this is not only more work, it also makes the code harder to read with the added validation logic. It is also 
solving the problem backwards. These values are derived, they should not need to be validated.

With this method signature, it is now impossible to use an unexpected ID or CreatedDate, those fields are derived in the
method itself. The person calling the code (often future you) will be thanking you for only exposing the relevant details
and 

## Freedom of Expression
You may have noticed that `AttachedURL` in the
`CreatePostParams` is a `*url.URL` object instead of string (we still convert it to a string on the storage model).
It may be that our caller code deals with `*url.URL` objects rather than strings or that we want to store the URL host
instead of the full URL. In those cases, it is much easier to pass in a `*url.URL` and have access to it's methods than
it is to parse the string into a `url.URL` inside the `CreatePost()` method. 
Using a parameters structure gives us the flexibility to choose any datatype we find most convenient.
