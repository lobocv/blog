---
title: "Building a Comfortable Dev Environment"
draft: true
date: 2021-05-01
categories: ["Developer Efficiency"]
---

I am a simple man, I enjoy the comfort and feel of home. When given the opportunity, 
I will find a way to make myself as comfortable as possible, and my software projects are no exception.

Docker and docker-compose make it easy to create a customized and reproducible development
environment for your software projects. In addition to the docker container, I have several scripts which help 
make common tasks dead simple. These tasks could be as trivial as building the docker image, starting and entering 
the development container and tearing it down when I'm finished.

In this post I'll talk about my particular work environment and how it lightens my cognitive load while developing.

### The Docker Container

At the heart of the development environment is the development container. This container contains all the tools and
dependencies I would need in order to perform my daily tasks. If the project I am working already has a public docker 
image with the main dependencies installed, I use that as the base image. For example, when I write `Go` applications,
I use the [golang](https://hub.docker.com/_/golang) docker image which already includes the go toolchain.
Afterwards, I install any additional dependencies I need for the project such as protocol buffers and linters.

```bash
FROM golang:1.16

RUN go get google.golang.org/protobuf/cmd/protoc-gen-go \
         google.golang.org/grpc/cmd/protoc-gen-go-grpc
```

### Accessing the Development Environment

To make it fast and simple to get going, I write a bash script that starts the container(s)
and enters the development container's shell, which I call the `devshell`: 

**devshell.sh**
```bash
#!/usr/bin/env bash

PROJECT_NAME=myproject
DEV_CONTAINER=dev
RC_FILE=/src/.devshell_bashrc

if [ "$1" == "-b" ]; then
  docker-compose -p ${PROJECT_NAME} build
fi

# Check if the dev container is already up. If it's not, then start it
[ ! "$(docker ps -a | grep ${DEV_CONTAINER})" ] && docker-compose -p ${PROJECT_NAME} up -d ${DEV_CONTAINER}

# Enter the dev shell and load the rc file
docker exec -it -e "TERM=xterm-256color" "${PROJECT_NAME}_${DEV_CONTAINER}_1" bash --rcfile ${RC_FILE}
```

This script checks if the docker container is already running so that it does not always need to call the somewhat
slow `docker-compose up` command.


### Customizing the environment

You may have noticed that in `devshell.sh` I provided an `--rcfile` parameter to `bash`. This allows us to setup any
customized environment we want in the developer shell. This can contain bash functions or aliases that are specific to
your project. For example, if you keep all your protocol buffer files in a particular directory, you can define a 
bash function or alias to generate all the protos.

Here is a basic example that I use in my golang projects:

**.devshell_bashrc**

```bash
=======================================
       Welcome to the dev shell!       
=======================================

# Define any common useful aliases or functions for the team 
alias gotest="go test ./..."
alias testify="go test -testify.m"
alias lint="golangci-lint run -v ./..."

# Source any user-specific / personal aliases or functions
if [[ -f .customrc ]]; then
    echo "Custom shell configuration found. Loading..."
    source .customrc
fi
```

### Customizing
At the end of the `.devshell_bashrc` example above, we source a `.customrc` file if it exists. You can use this file
to customize your devshell with anything you personally use. Be sure to add `.customrc` to your project's
`.gitignore` so that someone does not accidentally share their own custom scripts.

Here is an example of some additional personalization I do to my `devshell`:

**.customrc**

```bash
#!/bin/bash
echo "Hi Calvin!"

alias cd.="cd .."
alias cd..="cd ../.."
alias cd...="cd ../../.."
alias la="ls -lah"
alias gofmt="gofmt -w -s ."
alias run='go run ./...'
```

### Teardown and Cleanup

Tearing down the containers is as simple as calling `docker-compose down`. While a simple alias can suffice,
I like to write a script so that I have the abiility to add arguments in the future. It also makes the project more
portable as aliases need to be defined somewhere.

**devdown.sh**
```bash
#!/usr/bin/env bash

PROJECT_NAME=myproject

docker-compose -p ${PROJECT_NAME} down --remove-orphans
```

(I usually just have this in my `.bashrc` as an alias because it's so generic)
