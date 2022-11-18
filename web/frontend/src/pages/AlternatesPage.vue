<template>
  <div class="top-left-card">
    <q-card>
      <q-card-section>
        <div :style="{ display: 'flex', alignItems: 'center' }">
          <search-box
            ref="searchBox"
            :hint="$t('search.from')"
            :style="{ flex: 1 }"
            :force-text="fromPoi ? poiDisplayName(fromPoi) : undefined"
            v-on:did-select-poi="searchBoxDidSelectFromPoi"
          >
          </search-box>
          <q-btn
            size="small"
            :style="{ marginLeft: '0.5em', marginRight: 0 }"
            flat
            round
            color="primary"
            icon="gps_fixed"
            v-on:click="fromUserLocation"
          />
        </div>
      </q-card-section>
      <q-card-section class="no-top-padding">
        <search-box
          ref="searchBox"
          :hint="$t('search.to')"
          :force-text="toPoi ? poiDisplayName(toPoi) : undefined"
          v-on:did-select-poi="searchBoxDidSelectToPoi"
        ></search-box>
      </q-card-section>
      <q-card-section class="no-top-padding">
        <travel-mode-bar
          :current-mode="mode"
          :to-poi="toPoi"
          :from-poi="fromPoi"
        />
      </q-card-section>
    </q-card>
  </div>
  <div class="bottom-card bg-white" ref="bottomCard" v-if="fromPoi && toPoi">
    <q-list>
      <route-list-item
        v-for="item in routes"
        :click-handler="() => clickRoute(item)"
        :active="activeRoute === item"
        :duration-formatted="item.durationFormatted"
        :distance-formatted="item.lengthFormatted"
        v-bind:key="JSON.stringify(item)"
      >
        <q-item-label>
          {{ $t('via_$place', { place: item.viaRoadsFormatted }) }}
        </q-item-label>
        <q-item-label>
          <q-btn
            style="margin-left: -6px"
            padding="6px"
            flat
            icon="directions"
            :label="$t('route_picker_show_route_details_btn')"
            size="sm"
            v-on:click="showSteps(item)"
          />
        </q-item-label>
      </route-list-item>
    </q-list>
  </div>
</template>

<script lang="ts">
import { getBaseMap, setBottomCardAllowance } from 'src/components/BaseMap.vue';
import {
  canonicalizePoi,
  decanonicalizePoi,
  POI,
  poiDisplayName,
} from 'src/utils/models';
import { defineComponent, Ref, ref } from 'vue';
import SearchBox from 'src/components/SearchBox.vue';
import { Marker } from 'maplibre-gl';
import { useQuasar } from 'quasar';
import Route from 'src/models/Route';
import Place from 'src/models/Place';
import { TravelMode } from 'src/utils/models';
import RouteListItem from 'src/components/RouteListItem.vue';
import TravelModeBar from 'src/components/TravelModeBar.vue';
import { buildRouteLayer } from 'src/models/map';

var toPoi: Ref<POI | undefined> = ref(undefined);
var fromPoi: Ref<POI | undefined> = ref(undefined);

export default defineComponent({
  name: 'AlternatesPage',
  props: {
    mode: {
      type: String as () => TravelMode,
      required: true,
    },
    to: String,
    from: String,
  },
  data: function (): {
    routes: Route[];
    activeRoute?: Route;
  } {
    return {
      routes: [],
      activeRoute: undefined,
    };
  },
  components: { SearchBox, RouteListItem, TravelModeBar },
  methods: {
    poiDisplayName,
    clickRoute(route: Route) {
      this.$data.activeRoute = route;
      let index = this.$data.routes.indexOf(route);
      if (index !== -1) {
        this.renderRoutes(this.$data.routes, index);
      }
    },
    searchBoxDidSelectFromPoi(poi?: POI) {
      this.fromPoi = poi;
      this.rewriteUrl();
    },
    searchBoxDidSelectToPoi(poi?: POI) {
      this.toPoi = poi;
      this.rewriteUrl();
    },
    showSteps(route: Route) {
      let index = this.$data.routes.indexOf(route);
      if (index !== -1 && this.to && this.from) {
        this.$router.push(
          `/directions/${this.mode}/${encodeURIComponent(
            this.to
          )}/${encodeURIComponent(this.from)}/${index}`
        );
      }
    },
    fromUserLocation() {
      const options = {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      };
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fromPoi.value = {
            name: this.$t('my_location'),
            position: {
              lat: position.coords.latitude,
              long: position.coords.longitude,
            },
          };
          setTimeout(async () => {
            await this.rewriteUrl();
          });
        },
        (error) => {
          useQuasar().notify(this.$t('could_not_get_gps_location'));
          console.error(error);
        },
        options
      );
    },
    rewriteUrl: async function () {
      if (!fromPoi.value?.position && !toPoi.value?.position) {
        this.$router.push('/');
        return;
      }
      const fromCanonical = fromPoi.value
        ? canonicalizePoi(fromPoi.value)
        : '_';
      const toCanonical = toPoi.value ? canonicalizePoi(toPoi.value) : '_';
      this.$router.push(
        '/directions/' +
          encodeURIComponent(this.mode) +
          '/' +
          encodeURIComponent(toCanonical) +
          '/' +
          encodeURIComponent(fromCanonical)
      );
      await this.updateRoutes();
    },

    async updateRoutes(): Promise<void> {
      if (fromPoi.value?.position && toPoi.value?.position) {
        const fromCanonical = canonicalizePoi(fromPoi.value);
        // TODO: replace POI with Place so we don't have to hit pelias twice?
        let fromPlace = await Place.fetchFromSerializedId(fromCanonical);
        const routes = await Route.fetchBest(
          fromPoi.value,
          toPoi.value,
          this.mode,
          fromPlace.preferredDistanceUnits()
        );
        this.renderRoutes(routes, 0);
      } else {
        getBaseMap()?.removeLayersExcept([]);
        getBaseMap()?.removeMarkersExcept([]);
      }
    },
    renderRoutes(routes: Route[], selectedIdx: number) {
      this.$data.routes = routes;
      this.activeRoute = routes[selectedIdx];

      getBaseMap()?.removeLayersExcept([]);
      for (let routeIdx = 0; routeIdx < routes.length; routeIdx++) {
        // Add selected route last to be sure it's on top of the others
        if (routeIdx == selectedIdx) {
          continue;
        }
        const route = routes[routeIdx];
        const routeLayer = buildRouteLayer(
          `route_${routeIdx}`,
          route.geojson(),
          {
            'line-color': '#777',
            'line-width': 4,
            'line-dasharray': [0.5, 2],
          }
        );
        getBaseMap()?.pushRouteLayer(routeLayer);
      }

      const selectedRoute = routes[selectedIdx];
      const routeLayer = buildRouteLayer(
        `route_${selectedIdx}`,
        selectedRoute.geojson(),
        {
          'line-color': '#1976D2',
          'line-width': 6,
        }
      );
      getBaseMap()?.pushRouteLayer(routeLayer);

      setTimeout(async () => {
        this.resizeMap();
      });
      getBaseMap()?.fitBounds(selectedRoute.bounds);
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
  watch: {
    to(newValue) {
      setTimeout(async () => {
        toPoi.value = await decanonicalizePoi(newValue);
        this.resizeMap();

        if (!newValue.position) {
          return;
        }
        getBaseMap()?.pushMarker(
          'active_marker',
          new Marker({ color: '#111111' }).setLngLat([
            newValue.position.long,
            newValue.position.lat,
          ])
        );
        getBaseMap()?.removeMarkersExcept(['active_marker']);
      });
    },
    from(newValue) {
      setTimeout(async () => {
        fromPoi.value = await decanonicalizePoi(newValue);
        this.resizeMap();
      });
    },
    mode: async function (): Promise<void> {
      await this.updateRoutes();
      this.resizeMap();
    },
  },
  unmounted: function () {
    getBaseMap()?.removeLayersExcept([]);
  },
  mounted: async function () {
    setTimeout(async () => {
      toPoi.value = await decanonicalizePoi(this.$props.to as string);
      fromPoi.value = await decanonicalizePoi(this.$props.from as string);
      await this.rewriteUrl();
      this.resizeMap();

      getBaseMap()?.removeMarkersExcept([]);
      if (this.toPoi?.position) {
        const marker = new Marker({ color: '#111111' }).setLngLat([
          this.toPoi.position.long,
          this.toPoi.position.lat,
        ]);
        getBaseMap()?.pushMarker('active_marker', marker);
      }
    });
  },
  setup: function () {
    return {
      toPoi,
      fromPoi,
    };
  },
});
</script>
