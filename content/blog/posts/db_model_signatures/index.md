---
title: "why you shouldn't use domain models in API signatures"
draft: true
categories: ["Decoupling", "Design Patterns", "Golang"]
---

So you're writing some CRUD endpoints for your web application and you want to use a 
layered architecture to keep this clean and decoupled. You decide to separate the 
storage implementation from your API layer by creating two separate packages, a `api` 
package and `storage` package.

Lets add some more context here. Say you are creating a new social media platform, `blabber`
where you can share your thoughts about the world. The platform shares this post with the world
and lets people like, comment and share your post. Your API may have an endpoint to create a post:

`POST https://blabber.com/post`

In the body of the request we need to pass the follow information:  

```json
{
  "user_id": "qwe123",
  "body": "Hey! Checkout this cool blog!",
  "attached_url": "blog.lobocv.com",
}
```

In our API we have a model for a `Post`. This is the model that is returned whenever
we query for posts:

```go

type Post struct {
	ID string
	UserID string
	Body string
	AttachedURL string
	CreatedDate time.Time
}
```

Notice that in our database model for the `Post` we also store the date at which
the `Post` was created under `CreatedDate`.

Lets write a method in our storage layer to create the `Post` in database:

```go
func (db *Database) CreatePost(ctx context.Context, r *Post) (string, error) {
    insertOneResult, err := db.mongo.InsertOne(ctx, r)
    if err != nil {
    	return "", err
    }
    return insertOneResult.InsertedID.(string)
}
```

In the method signature, we pass the entire `Post` object, leaving the body of the function to 
simply insert it into the database and return the auto-generated database ID. This works, right?
Do you see any issues?

What we've done here is we have leaked our storage implementation outside of our storage package 
and into our `api` package. Our API package is now responsible for creating the `Post` 
object as it is represented in the database. It has full control on what goes into the database.

Lets forget the 
