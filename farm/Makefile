#
# build haproxy and stunnel
#
# dronnikov@gmail.com 2011
#

HAPROXY=haproxy-1.5-dev6
SPREAD=spread-src-4.1.0
STUNNEL=stunnel-4.36

all: bin js

#bin: $(HAPROXY)/haproxy $(SPREAD)/daemon/spread $(STUNNEL)/src/stunnel
bin: $(SPREAD)/daemon/spread
	strip -s $^
	cp $^ .

$(HAPROXY)/haproxy: $(HAPROXY)
	make -C $^ TARGET=linux26

$(HAPROXY): $(HAPROXY).tar.gz
	tar xzpf $^

$(HAPROXY).tar.gz:
	wget http://haproxy.1wt.eu/download/1.5/src/devel/$(HAPROXY).tar.gz

$(SPREAD)/daemon/spread: $(SPREAD)
	(cd $(SPREAD) ; ./configure )
	make -C $^

$(SPREAD): $(SPREAD).tar.gz
	tar xzpf $^

$(SPREAD).tar.gz:
	wget http://www.spread.org/download/$(SPREAD).tar.gz

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

#
# http://download.zeromq.org/zeromq-2.1.7.tar.gz
# uuid-dev
# sudo ldconfig
#

#
# http://www.spread.org/download/spread-src-4.1.0.tar.gz
#