import {
  SourceSpecification,
  LayerSpecification,
  LineLayerSpecification,
} from 'maplibre-gl';

export interface RouteLayerSpecification {
  sourceId: string;
  sourceSpec: SourceSpecification;
  layerSpec: LayerSpecification;
  aboveLayerType?: string;
}

export function buildRouteLayer(
  routeId: string,
  geojsonFeature: GeoJSON.Feature,
  paintSpec: LineLayerSpecification['paint']
): RouteLayerSpecification {
  const sourceId = `headway_route_${routeId}`;
  // Currently anyway, our Route layers and sources are 1-to-1 so we share the same ID.
  const layerId = sourceId;
  return {
    sourceId,
    sourceSpec: {
      type: 'geojson',
      data: geojsonFeature,
    },
    layerSpec: {
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: paintSpec,
    },
    aboveLayerType: 'symbol',
  };
}
