---
title: "Recursively Merging JSONB in PostgreSQL"
draft: false
date: 2021-05-01
categories: ["Databases"]
---

In addition to storing primitive data types such as `INT`, `FLOAT` and `VARCHAR`, 
PostgreSQL supports storing JSON and binary JSON (JSONB). These JSON types have a wide variety of
[functions and operators[1]](https://www.postgresql.org/docs/12/functions-json.html). 
One of the more common and useful operators is the concatenation operator,
`||`, which concatenates two jsonb values into a new JSONB value.

Example:
```postgresql
postgres=> SELECT '{"a": 1, "b": 2}'::jsonb || '{"b": 5, "c": 6}'::jsonb as result;

result
--------------------------
{"a": 1, "b": 5, "c": 6}

```

However, this concatenation is limiting. For one, if a key is present in both arguments, the
second value will completely overwrite the first. This is a problem for nested objects. The following
example attempts to update the `"author.age"` value from `30` to `31`, but also ends up removing
the `author.name` field.

```postgresql
SELECT '{"author": {"age": 30, "name": "Calvin"}}'::jsonb || '{"author": {"age": 31}}'::jsonb as result;

result
--------------------
{"author": {"age": 31}}
```

In order to preserve objects and have their fields merged instead of overwritten,
we need to write a custom function.

Here is the full function which recursively merges two JSON objects `A ` and `B`:

```postgresql
CREATE OR REPLACE FUNCTION jsonb_recursive_merge(A jsonb, B jsonb) 
RETURNS jsonb LANGUAGE SQL AS $$ 
SELECT 
    jsonb_object_agg( 
        coalesce(ka, kb), 
        CASE 
            WHEN va isnull THEN vb 
            WHEN vb isnull THEN va 
            WHEN jsonb_typeof(va) <> 'object' OR jsonb_typeof(vb) <> 'object' THEN vb 
            ELSE jsonb_recursive_merge(va, vb) END 
        ) 
    FROM jsonb_each(A) temptable1(ka, va)
    FULL JOIN jsonb_each(B) temptable2(kb, vb) ON ka = kb  
$$;
```

This function may be a bit hard to digest, so let's break it down:

```postgresql
SELECT jsonb_object_agg(
    ...
)
FROM jsonb_each(A) temptableA(ka, va)
FULL JOIN jsonb_each(B) temptableB(kb, vb) ON ka = kb
```

`jsonb_object_agg` is a built-in postgresql function which aggregates a list of (key, value) pairs into a JSON object.
This is what creates the final merged JSON result. Here we are applying `jsonb_object_agg` on the results of an 
in-memory temporary table that we are creating on the fly.

### Temporary tables

`jsonb_each()` is a built-in postgresql function that iterates a JSON object returning (key, value) pairs.
We call this function on both input JSON object `A` and `B` and then store the results in temporary tables 
`temptableA` and `temptableB` respectively.

`temptableA(ka, va)` is the definition of a temporary table with columns `ka` and `va` for the key and value results
of `jsonb_each()`. This is where `ka` and `va` are first introduced. We do the exact same thing for JSON
object `B` to get `kb` and `vb`.

Next we do a `FULL JOIN` with the two temporary tables on the key column. This gives us one 
table that has all the (key, value) pairs from both JSON objects `A` and `B`. Below is an
example of what the results of that table may look like:


| ka          | va | kb          | vb  |
|-------------|----|-------------|-----|
| likes       | 5  | likes       | 10  |
|             |    | comments    | 3   |
|    shares   | 1  |             |     |
| impressions | 65 | impressions | 130 |

Table 1: An example of a FULL JOIN with two temporary tables produced by `jsonb_each()`




It is this table from which we select the input to `jsonb_object_agg()`.
As we iterate through the rows of this joined temporary table, we need to determine
which key (`ka` or `kb`) and value (`va` or `vb`) we want to place in the resultant 
JSON object.


### Selecting the Key 
```postgresql
coalesce(ka, kb)
```


`coalesce` is a built in postgresql function that returns the first non null value it is given.
In this case it will choose `ka` if `kb` is null or `kb` if `ka` is null. Since we performed
our `FULL JOIN` on columns `ka = kb`, we are guaranteed to have a non-null value for either `ka`
or `kb`. When both `ka` and `kb` are non-null, they will be the same value.

### Selecting the Value

```postgresql
 CASE 
    WHEN va isnull THEN vb 
    WHEN vb isnull THEN va 
    WHEN jsonb_typeof(va) <> 'object' OR jsonb_typeof(vb) <> 'object' THEN vb 
    ELSE jsonb_recursive_merge(va, vb) END 
```

To select the value, we have a switch statement. The first two cases chooses the 
non-null value when one of the values is null. The third case is when both `va` and `vb`
are defined and **not both** JSON objects themselves. In this case we choose `vb` over `va` (remember we are merging `B` into `A`).
The final case (`else`) handles the situation where `va` and `vb` are both JSON objects. In that
situation we recursively call the `jsonb_recursive_merge` on `va` and `vb`. 

And there you have it, a custom PostgreSQL function that merges two JSON objects, preserving and 
merging any nested objects. I'd like to thank and give credit to `klin` and his
very helpful [StackOverflow](https://stackoverflow.com/a/42954907) answer which brought
me to a solution to this problem. 


### Using the function

One common use for this function is to upsert a row. In an upsert, when the row exists,
you want to update it and when it doesn't, you want to insert a new one.
To do this, you would use an `INSERT` statement with the `ON CONFLICT (col1,..., colN) DO UPDATE SET` clause.
The columns in the clause specify the columns of a unique index. Following the clause is a list of 
`column_name = <expression>` statements that decide just how each column is to be updated. 

Below is an example of updating a table of tweet metrics: 

```postgresql
INSERT INTO tweets (id, metrics)
VALUES (1, '{"likes": 22, "comments": 12}')
ON CONFLICT (id) DO UPDATE
SET metrics = jsonb_recursive_merge(tweets.metrics, excluded.metrics);
```

In the statement above, if a row with the same ID exists, it will call the `jsonb_recursive_merge` function on
the current value, `tweets.metrics`, and the inserted value, `excluded.metrics` (the `excluded` table is the
name of the special table representing rows proposed for insertion[2]).

### Limitations

When we designed our `jsonb_recursive_merge` function we had to decide what "merge" meant to us. We decided
that an overwrite of a value constitutes a "merge". But what about values that are arrays? One 
could argue that merging two arrays `[1, 2, 3]` and `[4, 5, 6]` should result in `[1,2,3,4,5,6]`. It really
all depends on the context of what you are trying to do. 

If you want to also merge the values of arrays you can add an extra `case` statement that appends the values when
both `va` and `vb` are arrays:

```postgresql
WHEN jsonb_typeof(va) = 'array' AND jsonb_typeof(vb) = 'array' THEN va || vb
```

However, be aware that this will apply to **all** arrays encountered in the JSON objects.

## Further Reading
[1] [JSON Functions and Operators](https://www.postgresql.org/docs/12/functions-json.html)

[2] [PostgresSQL Insert Documentation](https://www.postgresql.org/docs/12/sql-insert.html)
