FROM klakegg/hugo:ext-ubuntu

RUN apt update && apt -y install vim curl

CMD [hugo, server]
