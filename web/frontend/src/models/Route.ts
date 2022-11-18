import { i18n } from 'src/i18n/lang';
import { LngLat, LngLatBounds, LngLatBoundsLike } from 'maplibre-gl';
import {
  ValhallaClient,
  ValhallaRoute,
  ValhallaMode,
  ValhallaRouteLegManeuver,
} from 'src/services/ValhallaClient';
import { POI, DistanceUnits, TravelMode } from 'src/utils/models';
import { formatDuration } from 'src/utils/format';
import { decodeValhallaPath } from 'src/third_party/decodePath';
export default class Route {
  public readonly durationSeconds: number;
  public readonly durationFormatted: string;
  public readonly viaRoadsFormatted: string;
  public readonly lengthFormatted: string;
  public readonly bounds: LngLatBoundsLike;
  public readonly geojson: () => GeoJSON.Feature;

  constructor(
    durationSeconds: number,
    durationFormatted: string,
    viaRoadsFormatted: string,
    lengthFormatted: string,
    bounds: LngLatBoundsLike,
    geojson: () => GeoJSON.Feature
  ) {
    this.durationSeconds = durationSeconds;
    this.durationFormatted = durationFormatted;
    this.viaRoadsFormatted = viaRoadsFormatted;
    this.lengthFormatted = lengthFormatted;
    this.bounds = bounds;
    this.geojson = geojson;
  }

  public static async fetchBest(
    from: POI,
    to: POI,
    mode: TravelMode,
    units?: DistanceUnits
  ): Promise<Route[]> {
    const vRoutes = await ValhallaClient.fetchRoutes(
      from,
      to,
      mode as ValhallaMode,
      units
    );
    return vRoutes.map(Route.fromValhalla);
  }

  public static fromValhalla(route: ValhallaRoute): Route {
    const viaRoads = substantialRoadNames(route.legs[0].maneuvers, 3);
    const viaRoadsFormatted = viaRoads.join(
      i18n.global.t('punctuation_list_seperator')
    );

    const summary = route.summary;
    const bounds = new LngLatBounds(
      new LngLat(summary.min_lon, summary.min_lat),
      new LngLat(summary.max_lon, summary.max_lat)
    );

    const leg = route.legs[0];
    const shape = leg.shape;
    const geojson: () => GeoJSON.Feature = () => {
      const points: [number, number][] = [];
      decodeValhallaPath(shape, 6).forEach((point) => {
        points.push([point[1], point[0]]);
      });
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points,
        },
      };
    };
    const args = {
      geojson,
      bounds,
      durationSeconds: route.summary.time,
      durationFormatted: formatDuration(route.summary.time, 'shortform'),
      viaRoadsFormatted,
      lengthFormatted:
        route.summary.length.toFixed(1) +
        ' ' +
        route.units
          .replace(
            'kilometers',
            i18n.global.t('shortened_distances.kilometers')
          )
          .replace('miles', i18n.global.t('shortened_distances.miles')),
    };

    return new Route(
      args.durationSeconds,
      args.durationFormatted,
      args.viaRoadsFormatted,
      args.lengthFormatted,
      args.bounds,
      args.geojson
    );
  }
}

function substantialRoadNames(
  maneuvers: ValhallaRouteLegManeuver[],
  limit: number
): string[] {
  const roadLengths = [];
  let cumulativeRoadLength = 0.0;
  for (const maneuver of maneuvers) {
    const length = maneuver.length;
    cumulativeRoadLength += length;
    if (maneuver.street_names) {
      const name = maneuver.street_names[0];
      roadLengths.push({ name, length });
    }
  }
  roadLengths.sort((a, b) => b.length - a.length).slice(0, limit);

  // Don't include tiny segments in the description of the route
  const inclusionThreshold = cumulativeRoadLength / (limit + 1);
  let substantialRoads = roadLengths.filter(
    (r) => r.length > inclusionThreshold
  );

  if (substantialRoads.length == 0) {
    substantialRoads = [roadLengths[0]];
  }

  return substantialRoads.map((r) => r.name);
}
