---
title: "Building a Comfortable Dev Environment"
draft: false
date: 2021-05-01
categories: ["Developer Efficiency"]
---

I am a simple man, I enjoy the comfort and feel of home. When given the opportunity, 
I will find a way to make myself as comfortable as possible, and my software projects are no exception.

Docker and docker-compose make it simple to create a customized and reproducible development
environment for your team's software projects. In addition to the docker container, I have several scripts which help 
make common tasks dead simple. These tasks could be as trivial as building the docker image, starting and entering 
the development container and tearing it down when I'm finished.

In this post I'll talk about my particular work environment and how it lightens my cognitive load while developing.
You can try out the examples discussed in this post [here]()

### The Docker Container

At the heart of the development environment is the development container. This container contains all the tools and
dependencies I would need in order to perform my daily tasks. If a public docker image with the main 
dependencies installed already exists, I use that as the base image for the dev container. For example, when I write `Go` applications,
I use the [golang](https://hub.docker.com/_/golang) docker image which already includes the go toolchain.
Afterwards, I install any additional dependencies I need for the project such as protocol buffers and linters.

**Dockerfile**
```bash
FROM golang:1.16

RUN go get google.golang.org/protobuf/cmd/protoc-gen-go \
         google.golang.org/grpc/cmd/protoc-gen-go-grpc
```

Docker-compose makes it simple to orchestrate several containers which can then communicate with one another via a common network or
share a volumes with the host or one another. In the following docker-compose example config, I define the development 
container, `dev`, and mount my local filesystem (`./`) to a `/src` folder inside the container. This allows my development
container have access to code in the repository and immediately see changes being made to them. The configuration also
starts up a MongoDB container named `mongo`.

**docker-compose.yaml**
```
version: "3"

services:

  dev:
    build:
      context: .
      dockerfile:  ./Dockerfile
    command: sleep 1000000
    volumes:
      - ./:/src

  mongo:
    image: mongo:4.4-bionic

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

# If the -b flag is provided then build the containers before entering the shell
if [ "$1" == "-b" ]; then
  docker-compose -p ${PROJECT_NAME} build
fi

# Check if the dev container is already up. If it's not, then start it
[ ! "$(docker ps | grep ${DEV_CONTAINER})" ] && docker-compose -p ${PROJECT_NAME} up -d ${DEV_CONTAINER}

# Enter the dev shell and load the rc file
docker exec -it -e "TERM=xterm-256color" "${PROJECT_NAME}_${DEV_CONTAINER}_1" bash --rcfile ${RC_FILE}
```

This script checks if the docker container is already running so that it does not always need to call the (somewhat)
slow `docker-compose up` command.


### Customizing the environment

You may have noticed that in `devshell.sh` I provided an `--rcfile` parameter to `bash`. This allows us to setup any
customized environment we want in the developer shell. This can contain functions or aliases that are specific to
your project. I like to have this script define a `help()` function and print it upon entry of the shell.
This helps new team members joining the project get accustom to what features exist in the devshell.
It also helps broadcast any improvements added to the shell and acts as reference documentation for the devshell.  

**.devshell_bashrc**

```bash
# Define any common useful aliases or functions for the team 
alias gotest="go test ./..."
alias testify="go test -testify.m"
alias lint="golangci-lint run -v ./..."
# Set default cd to go to project root
alias cd='HOME=/src cd'

function help() {
  echo "
=======================================
Welcome to the dev shell
=======================================

Type "help" in the shell to repeat this message.

Additional shell customizations can be loaded by creating a .customrc file in the root of the project.

Here is a list of common commands you can do:

* gotest: Run all go tests in the current directory

* lint: Run golangci-lint in the current directory

* testify: Run a testify test by name
  Arguments:
      1 : Regex to match test names
"
}

# Source any user-specific / personal aliases or functions
if [[ -f .customrc ]]; then
    echo "Custom shell configuration found. Loading..."
    source .customrc
fi

help

```

### Personalizing the Shell
At the end of the `.devshell_bashrc` script above, we source a `.customrc` file if it exists. You can use this file
to personalize your devshell. Be sure to add `.customrc` to your project's
`.gitignore` so that someone does not accidentally share their own personal scripts.

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

While these examples are pretty general purpose, there are many ways you can tailor your environment
to speed up your development flows. Be creative! Here are some ideas:
- Changing to a particular directory which I often use
- Run a particular tool such as generating proto files 
- Building and running a service via a regex
- Changing to a particular project directory via a regex
- Shortcuts interacting with ElasticSearch: List/delete aliases, templates, indices  

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
