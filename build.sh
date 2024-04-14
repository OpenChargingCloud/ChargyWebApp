#!/bin/bash

sass src/css/chargy.scss src/css/chargy.css
webpack -c webpack.config.cjs
