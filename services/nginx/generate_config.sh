#!/bin/bash

# Generates json appropriate for our frontend app's configuration.
#
# This script is terrible and I look forward to a better solution which:
#
# 1. allows the nginx container to be re-used in different environments (without rebuilding)
# 2. doesn't require the user's client to make extra requests (like the system this terrible script replaced.)

function usage() {
cat >&2 << EOS
Usage:
    HEADWAY_ENABLE_TRANSIT_ROUTING=<0|1> <HEADWAY_BBOX=<bbox_format>> $0

    <bbox_format>: west_lng south_lat east_lng north_lat

Examples:
    HEADWAY_ENABLE_TRANSIT_ROUTING=1 HEADWAY_BBOX="1 2 3 4" $0
    HEADWAY_ENABLE_TRANSIT_ROUTING=0 $0
EOS
}

if [ ! -z "$HEADWAY_BBOX" ]; then
    # remove leading and trailing space, then comma separate
    comma_seperated_bounds=$(echo $HEADWAY_BBOX | sed 's/^ *//' | sed 's/ *$//' | sed 's/  */,/g')
    bbox_json="[${comma_seperated_bounds}]";
else
    bbox_json="null"
fi

if [ -z "$HEADWAY_ENABLE_TRANSIT_ROUTING" ]; then
    usage
    exit 1
fi

if [[ "$HEADWAY_ENABLE_TRANSIT_ROUTING" == 0 ]]; then
    transit_routing_enabled_json="false";
else
    transit_routing_enabled_json="true";
fi

cat << EOS
{
    "maxBounds": $bbox_json,
    "transitRoutingEnabled": $transit_routing_enabled_json
}
EOS

