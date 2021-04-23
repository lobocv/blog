#!/usr/bin/env bash
docker run -it -v $PWD:/src -p "1313:1313" calvin-blog server -b "localhost:1313/"
