FROM klakegg/hugo:ext-ubuntu

RUN apt update && apt -y install vim.tiny curl

CMD [hugo, server]
