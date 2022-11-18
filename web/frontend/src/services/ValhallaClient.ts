import { POI, DistanceUnits } from 'src/utils/models';

export type ValhallaMode = 'walk' | 'bicycle' | 'car';

function modeToCostingModel(mode: ValhallaMode): string {
  switch (mode) {
    case 'walk':
      return 'pedestrian';
    case 'bicycle':
      return 'bicycle';
    case 'car':
      return 'auto';
  }
}

export interface ValhallaRouteLegManeuver {
  begin_shape_index: number;
  end_shape_index: number;
  street_names?: string[];
  time: number;
  cost: number;
  length: number;
  instruction: string;
  verbal_post_transition_instruction: string;
  type: number;
}

export interface ValhallaRouteSummary {
  time: number;
  length: number;
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

export interface ValhallaRouteLeg {
  maneuvers: ValhallaRouteLegManeuver[];
  shape: string;
}

export interface ValhallaRoute {
  legs: ValhallaRouteLeg[];
  summary: ValhallaRouteSummary;
  units: string;
}

export class ValhallaClient {
  public static async fetchRoutes(
    from: POI,
    to: POI,
    mode: ValhallaMode,
    units?: DistanceUnits
  ): Promise<ValhallaRoute[]> {
    if (!from.position || !to.position) {
      console.error("Can't request without fully specified endpoints");
      return [];
    }

    type RouteRequest = {
      locations: Array<{ lat: number; lon: number }>;
      costing: string;
      alternates: number;
      units?: DistanceUnits;
    };
    const requestObject: RouteRequest = {
      locations: [
        {
          lat: from.position.lat,
          lon: from.position.long,
        },
        {
          lat: to.position.lat,
          lon: to.position.long,
        },
      ],
      costing: modeToCostingModel(mode),
      alternates: 3,
    };
    if (units) {
      requestObject.units = units;
    }
    const response = await fetch(
      `/valhalla/route?json=${JSON.stringify(requestObject)}`
    );
    if (response.status !== 200) {
      console.error('Valhalla response gave error: ' + response.status);
      return [];
    }
    const responseJson = await response.json();
    const routes: ValhallaRoute[] = [];
    const route = responseJson.trip as ValhallaRoute;
    if (route) {
      routes.push(route);
    }
    for (const altIdx in responseJson.alternates) {
      const route = responseJson.alternates[altIdx].trip as ValhallaRoute;
      if (route) {
        routes.push(route);
      }
    }
    return routes;
  }
}
