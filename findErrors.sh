#!/bin/bash
fold -w 80 $1 > $1.f
grep -H NODE_ENV $1.f
rm $1.f
