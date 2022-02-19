---
title: "Building a Comfortable Dev Environment"
draft: false
date: 2021-07-06
categories: ["Developer Efficiency"]
---

Being a software developer can be overwhelming at times. There are an endlessly diverse set of tools, technologies, languages 
and frameworks to choose from. To make it worse, that list grows larger and larger each day. Tools like git, docker,
docker-compose, kubernetes, ssh, curl, sed, awk, grep, jq etc. are all tools we use multiple times a day. 

Most of these 
tools have a small subset of commands / flags or use-cases that we use most often. In more complex cases, these tools can
be piped together. As the years go by, with repetition, you end up
memorizing these commands. This is great for productivity, but it takes time! 

In the meantime, while you have yet to internalize these commands, your brain needs to stop (even for a second) to think:
"What was that flag again?"

These small but frequent context switches cause us to lose a step on what is more important at the time: solving that bug,
or finishing that feature. The solution is simple. Keep a cheatsheet of all your favorite commands written on cue cards.
Tuck that cue card under your pillow and each night before bed, recite all the commands in their entirety out loud as you
eventually fall asleep.


...

No. We're not in school anymore (well some of you may be). There is a (much) better way of removing this
unnecessary cognitive load so you can always stay focused on your task at hand.

In this article I am going to talk about a few things I do to speed up my development flow. I've found this incredibly 
valuable and I hope you do too. Best of all, you can take as much or as little from this flow as suites you. 


Customize it, change it, **improve** it and share your results, I would love to hear it.

Let's get started with the simplest thing you can do:

## The Shell

### Aliases

A shell alias is a shortcut that you can define for any command. They are simple to create and can save you a lot of time
and memorizing. For example, instead of typing `ls -lah` each time, you can create an alias `la` that would do the exact 
same thing:

```bash
alias la="ls -lAh"
```

Aliases act as a run-time replacement of your alias with the defined command. This means you can augment your alias on
the fly:

```bash
la -R
```

would translate to:

```bash
ls -lAh -R
```

Aliases are a great way to turn that awkward to remember or type command into something dead simple that you can
remember immediately. There is no alias too silly or simple. The following are probably my most commonly used aliases:

```bash
alias cd.="cd .."
alias cd..="cd ../.."
alias cd...="cd ../../.."
```

Lastly, aliases need to be loaded into your shell. The most common way of loading aliases is to define them in your `.bashrc`
so that they are defined whenever you open a new shell.

### Shell Functions

An even more flexible option to aliases are shell functions. These act similarly to an alias but instead of simply
replacing text being sent to your shell's [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop), it executes the shell code you've defined. Use shell functions whenever
you want to do something more complex than just shortcuts such as provide input arguments, flags and pipe input. 
Below is an example function to extract a specific JSON key-value from input:

```bash
# Reads from JSON from stdin and print outs the value of the specified key
# $1: Key to print
# Example: echo '{"a": 1, "b": 2}' | jsonparsekey b
# > 2
function jsonparsekey() {
	local KEY=$1
	python -c "import sys,json; s=json.loads(''.join([l for l in sys.stdin])); print s['$KEY']"
}
```

I find this useful for filtering response data of HTTP APIs as I am debugging.

Check out some of my other [aliases and shell functions](https://github.com/lobocv/mysetup/tree/master/aliases). 

### Upgrade from Bash

Bash is ubiquitous and great, but over the years people have developed much more full-featured and customizable 
shells such as [zsh](https://www.zsh.org/) and [fish](https://fishshell.com/). I would highly recommend looking into these
shells or the many others that exist. I personally use `zsh` with the [oh-my-zsh](https://ohmyz.sh/) configuration manager 
to extend and customize the shell to my liking.

## Storing your Configuration

Over the years you will likely be using many different computers. I personally have my home desktop, a personal laptop and
my work laptop. To keep configurations on all my devices in sync I have a [git repository](https://github.com/lobocv/mysetup) 
which stores all my aliases, shell functions, zsh plugins and common system packages. This repo also prevents me from losing
and having to recreate configurations as I reinstall my OS or format my hard drives. 

I even have a [script](https://github.com/lobocv/mysetup/blob/master/load_aliases.sh) 
that loads the repository, keeping my `.zshrc` file edits minimal:

**.zshrc**
```bash
source ~/lobocv/mysetup/load_aliases.sh
```


## Containerized Environments

Docker and docker-compose make it simple to create a customized and reproducible development
environment for your team's software projects. In addition to the docker container, I have several scripts which help 
make common tasks dead simple. These tasks could be as trivial as building the docker image(s), starting and entering 
the development container and tearing it down when I'm finished.


### The Docker Container

At the heart of the development environment is the development container. This container contains all the tools and
dependencies I would need in order to perform my daily tasks. If a public docker image with the main 
dependencies installed already exists, I use that as the base image for the dev container. For example, when I write `Go` applications,
I use the [golang](https://hub.docker.com/_/golang) docker image which already includes the go toolchain.
Afterwards, I install any additional dependencies I need for the project such as protocol buffers and linters.

**Dockerfile**
```dockerfile
FROM golang:1.16

RUN go get google.golang.org/protobuf/cmd/protoc-gen-go \
         google.golang.org/grpc/cmd/protoc-gen-go-grpc
```

Docker-compose makes it simple to orchestrate several containers which can then communicate with one another via a common network or
share volumes with the host or one another. In the following docker-compose example config, I define the development 
container, `dev`, and mount my local filesystem (`./`) to a `/src` folder inside the container. This allows my development
container have access to code in the repository and immediately see changes being made to them from my IDE. 

The example configuration below also starts up a MongoDB container named `mongo`.

**docker-compose.yaml**
```dockerfile
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
customized environment we want in the devshell. This can contain functions or aliases that are specific to
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
At the end of the `.devshell_bashrc` script above, we source a `.customrc` file (if it exists). Each member of your team 
can use this file to personalize their devshell. Be sure to add `.customrc` to your project's
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
- Building and running a program / service via a regex
- Changing to a particular project directory via a regex
- Shortcuts interacting with ElasticSearch: List/delete aliases, templates, indices  

### Teardown and Cleanup

Tearing down the containers is as simple as calling `docker-compose down`. Although this is a simple command, having it 
defined as a script opens the door to add more functionality such as only shutting down certain containers. 
It also provides nice symmetry to `devshell.sh` and makes things dead simple.

**devdown.sh**
```bash
#!/usr/bin/env bash

PROJECT_NAME=myproject

docker-compose -p ${PROJECT_NAME} down --remove-orphans
```

### Try it yourself

A working example of this development environment can be found at my [project-bootstrap repository](https://github.com/lobocv/project-bootstrap).
Feel free to try it out!

## Make it your own

There is a lot of focus on optimizing your code or algorithms, but optimizing your development efficiency is one of the 
highest impact changes you can make. These are just some examples of what you can do. Be creative and come up with your own
optimizations. Keep track of the context changes and inefficiencies in your workflow and you'll be surprised how much of
an impact it can have on your output. Keep in mind, that unlike code, these gains with follow you throughout your professional career.
