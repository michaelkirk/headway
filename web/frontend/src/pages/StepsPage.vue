<template>
  <div class="top-left-card"></div>
  <q-btn
    round
    icon="arrow_back"
    class="top-left-fab"
    v-on:click="() => onBackClicked()"
  />
  <div class="bottom-card bg-white" ref="bottomCard">
    <q-list>
      <div v-for="item in $data.steps" v-bind:key="JSON.stringify(item)">
        <q-item class="q-my-sm" active-class="bg-blue-1">
          <q-item-section avatar>
            <q-icon :name="valhallaTypeToIcon(item.type)" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ item.instruction }}
            </q-item-label>
            <q-item-label caption>
              {{ item.verbal_post_transition_instruction }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator spaced />
      </div>
    </q-list>
  </div>
</template>

<script lang="ts">
import {
  getBaseMap,
  map,
  setBottomCardAllowance,
} from 'src/components/BaseMap.vue';
import {
  decanonicalizePoi,
  poiDisplayName,
  TravelMode,
  canonicalizePoi,
} from 'src/utils/models';
import Place from 'src/models/Place';
import Route from 'src/models/Route';
import { defineComponent } from 'vue';
import { Marker } from 'maplibre-gl';
import { valhallaTypeToIcon } from 'src/utils/format';
import {
  ValhallaClient,
  ValhallaMode,
  ValhallaRouteLegManeuver,
} from 'src/services/ValhallaClient';
import { buildRouteLayer } from 'src/models/map';

export default defineComponent({
  name: 'StepsPage',
  props: {
    mode: {
      type: String as () => TravelMode,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    alternateIndex: {
      type: String,
      required: true,
    },
  },
  data: function (): {
    steps: ValhallaRouteLegManeuver[];
  } {
    return {
      steps: [],
    };
  },
  methods: {
    poiDisplayName,
    valhallaTypeToIcon,
    onBackClicked() {
      let params = Object.assign({}, this.$router.currentRoute.value.params);
      delete params.alternateIndex;

      // Strangely pushing like this updates the URL, but the alternates page
      // doesn't actually load - the "steps" are hidden, but the to/from fields
      // and route picker UI isn't shown.
      //    this.$router.push({ name: 'alternates', params });
      //
      // But for some reason, resolving the route to a url string, and pushing the string
      // haves as expected.
      let path = this.$router.resolve({
        name: 'alternates',
        params,
      }).fullPath;
      this.$router.push(path);
    },
    clearPolylines() {
      for (var i = 0; i < 10; i += 1) {
        if (map?.getLayer('headway_polyline' + i)) {
          map?.removeLayer('headway_polyline' + i);
        }
        if (map?.getSource('headway_polyline' + i)) {
          map?.removeSource('headway_polyline' + i);
        }
      }
    },
    resizeMap() {
      if (this.$refs.bottomCard && this.$refs.bottomCard) {
        setBottomCardAllowance(
          (this.$refs.bottomCard as HTMLDivElement).offsetHeight
        );
      } else {
        setBottomCardAllowance(0);
      }
    },
  },
  beforeUnmount: function () {
    this.clearPolylines();
  },
  mounted: async function () {
    setTimeout(async () => {
      const fromPoi = await decanonicalizePoi(this.$props.from as string);
      const toPoi = await decanonicalizePoi(this.$props.to as string);

      if (!fromPoi || !toPoi) {
        console.error('missing POI');
        return;
      }

      // TODO: avoid this roundtrip by replacing POI with Place.
      let fromPlace = await Place.fetchFromSerializedId(
        canonicalizePoi(fromPoi)
      );
      const vRoutes = await ValhallaClient.fetchRoutes(
        fromPoi,
        toPoi,
        this.$props.mode as ValhallaMode,
        fromPlace.preferredDistanceUnits()
      );

      let selectedIdx = parseInt(this.$props.alternateIndex);
      let vRoute = vRoutes[selectedIdx];
      this.$data.steps = vRoute.legs[0].maneuvers;
      let route = Route.fromValhalla(vRoute);
      getBaseMap()?.pushRouteLayer(
        buildRouteLayer('route_' + selectedIdx, route.geojson(), {
          'line-color': '#1976D2',
          'line-width': 6,
        })
      );
      this.resizeMap();

      getBaseMap()?.removeMarkersExcept([]);
      if (toPoi.position) {
        const marker = new Marker({ color: '#111111' }).setLngLat([
          toPoi.position.long,
          toPoi.position.lat,
        ]);
        getBaseMap()?.pushMarker('active_marker', marker);
      }
    });
  },
  unmounted: function () {
    if (map?.getLayer('headway_polyline')) {
      map?.removeLayer('headway_polyline');
    }
    if (map?.getSource('headway_polyline')) {
      map?.removeSource('headway_polyline');
    }
  },
});
</script>
