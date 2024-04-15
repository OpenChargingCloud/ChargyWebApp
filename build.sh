#!/bin/bash

mkdir -p build/css
sass html/css/chargy.scss build/css/chargy.css
webpack -c webpack.config.cjs
