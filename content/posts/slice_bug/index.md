---
title: "A Cautionary tale of reference slices"
draft: false
date: 2021-10-16
categories: ["Go"]
---

In Go, it is common to use slices instead of arrays. Slices provide a layer of convenience for common operation with
arrays such as appending and slicing (shocker!). Slices are so ubiquitous in Go that it is easy to forget
what they are truly doing for you under the hood, especially when in most cases the details are not material to the task at hand.
This is (somewhat contrived) example of when that is not the case: when using a slice, as if it were an array, can cause subtle bugs.


In this example, we are building a metric viewer for social media ads. In this viewer, customers can see all
their ads in a table form. The columns of the table make up metadata on the ads, such as the
ad name, status, objective etc, as well as metrics associated with each ad, such as the impressions and likes that the
ad has. 

| Ad Set Name | Ad ID     |  Status     | Impressions | Likes |
|-------------|-----------|-------------| ------------| ------|


For our product, we some additional features that are only visible if you have a premium plan and the feature enabled.
One of these features is a calculation on return on investment (ROI). If the user has a premium plan and the ROI feature 
setup on their account, their table should include an additional metadata column for ROI.

| Ad Set Name | Ad ID     |  Status     | ROI  | Impressions | Likes |
|-------------|-----------|-------------| -----| ------------| ------|

One way to code keep track of the metadata columns is to define the basic plan columns in a slice. This makes sense because
these are columns that all users, regardless of their plan, should be able to see.



```

type Column struct {
	ID int          `json:"id"
	Name string     `json:"name"
	// Other fields...
}

var (
	AdSetName = Column{ID: 1, Name: "Ad Set Name"}
	AdID = Column{ID: 2, Name: "Ad ID"}
	Status = Column{ID: 3, Name: "Status"}
	ROI = Column{ID: 4, Name: "ROI"}

    BasicPlanColumns = []Column{AdSetName, AdID, Status}
)

```


When the user makes an API request to view their data, we can check their entitlements and create the
final slice of metadata columns that they see.


```

func GetColumns(resp *http.ResponseWriter, req *http.Request) {

    userId := req.Header.Get(hshttpc.HeaderUserID)
    
    columns := BasicPlanColumns
    
    if isPremiumUser(userID) && hasROIConfigured(userID) {
        columns = append(columns, ROI)
    }
    
    // return the columns in the response
}
```


To test your code, you make a user with a premium plan make an API request:

```json

[
  {"id":  1, "name":  "Ad Set Name"},
  {"id":  2, "name":  "Ad ID"},
  {"id":  3, "name":  "Status"},
  {"id":  4, "name":  "ROI"}
]
```

That looks correct. So then you test a user with a basic plan:

```json

[
  {"id":  1, "name":  "Ad Set Name"},
  {"id":  2, "name":  "Ad ID"},
  {"id":  3, "name":  "Status"},
]
```


Great, everything looks good. The basic user does not see the premium plan column (ROI) while the premium plan user does.
Ship it.

A few months down the road the company wants to include another premium feature, tags on content. Another developer picks 
up the ticket, and luckily for them, the changes they need to make to the API look obvious: define a new column for the
tags and add it to the `columns` slice only if they are a premium user and the user has the feature configured.

```

func GetColumns(resp *http.ResponseWriter, req *http.Request) {

    userId := req.Header.Get(hshttpc.HeaderUserID)
    
    columns := BasicPlanColumns[socialNetwork]
    
    if isPremiumUser(userID) {
        if hasROIConfigured(userID) {
            columns = append(columns, ROI)
        }
        if hasTagsConigured(userID) {
            columns = append(columns, Tags)
        }    
    }
    
    // return the columns in the response
}
```

And then the bugs start flowing in. Customers start reporting that they are seeing the ROI column when they do not use 
that feature. Other customers starts complaining that they are missing the ROI column and instead seeing a Tags column.
However, you never get any complaints from customers that use both tags and ROI features.
You look at your unit tests and everything looks good.

Lets cut to the chase. Remember when I mentioned that each social network has it's own set of metadata fields. Well it
turns out, the way that these fields are read in from the configuration file causes the underlying array to be over-allocated in size.
The facebook 





## Further Reading
[1] 

[2] 
