#
# build haproxy and stunnel
#
# dronnikov@gmail.com 2011
#

HAPROXY=haproxy-1.5-dev6
STUNNEL=stunnel-4.36

all: bin js

bin: $(HAPROXY)/haproxy $(STUNNEL)/src/stunnel
	strip -s $^
	cp $^ .

$(HAPROXY)/haproxy: $(HAPROXY)
	make -C $^ TARGET=linux26

$(HAPROXY): $(HAPROXY).tar.gz
	tar xzpf $^

$(HAPROXY).tar.gz:
	wget http://haproxy.1wt.eu/download/1.5/src/devel/$(HAPROXY).tar.gz

$(STUNNEL)/src/stunnel: $(STUNNEL)
	(cd $(STUNNEL) ; ./configure )
	make -C $^

$(STUNNEL): $(STUNNEL).tar.gz
	tar xzpf $^
	(cd $@ ; patch -Np1 < ../stunnel-4.36-sendproxy.diff >1 2>2)

$(STUNNEL).tar.gz:
	wget http://ftp.nluug.nl/pub/networking/stunnel/$(STUNNEL).tar.gz

js: ender.min.js

ender.min.js:
	ender build underscore jeesh backbone capsule scriptjs json-browser

.PHONY: all bin js
