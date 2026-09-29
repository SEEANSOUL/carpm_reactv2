import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { RouteSketch } from './RouteSketch';

type Point = { latitude: number; longitude: number };
type Marker = Point & { id: string; title?: string };

type Props = {
  points: Point[];
  follow?: Point | null;
  initial?: Point | null;
  showUserLocation?: boolean;
  markers?: Marker[];
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

function mapDocument(token: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #000000; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  mapboxgl.accessToken = ${JSON.stringify(token)};
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [28.9784, 41.0082],
    zoom: 14
  });
  const markers = {};
  let ready = false;
  let pending = null;

  function apply(state) {
    const line = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: (state.points || []).map((p) => [p.longitude, p.latitude])
      }
    };
    const source = map.getSource('route');
    if (source) source.setData(line);

    const nextIds = {};
    (state.markers || []).forEach((marker) => { nextIds[marker.id] = true; });
    Object.keys(markers).forEach((id) => {
      if (!nextIds[id]) {
        markers[id].remove();
        delete markers[id];
      }
    });
    (state.markers || []).forEach((marker) => {
      const lngLat = [marker.longitude, marker.latitude];
      if (!markers[marker.id]) {
        const el = document.createElement('div');
        const me = marker.id === 'me';
        el.style.width = me ? '16px' : '14px';
        el.style.height = me ? '16px' : '14px';
        el.style.borderRadius = '8px';
        el.style.border = '2px solid #ffffff';
        el.style.background = marker.id === 'start' ? '#FFFFFF' : '#E10600';
        el.style.boxShadow = me ? '0 0 0 7px rgba(225,6,0,0.35)' : 'none';
        markers[marker.id] = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
      } else {
        markers[marker.id].setLngLat(lngLat);
      }
    });

    const focus = state.follow || state.initial;
    if (focus) {
      map.easeTo({
        center: [focus.longitude, focus.latitude],
        zoom: state.follow ? 16 : Math.max(map.getZoom(), 13),
        duration: 450
      });
    }
  }

  window.updateDrive = function (state) {
    if (!ready) {
      pending = state;
      return;
    }
    apply(state);
  };

  map.on('load', () => {
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
    });
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#E10600', 'line-width': 5 }
    });
    ready = true;
    if (pending) apply(pending);
  });
</script>
</body>
</html>`;
}

export function DriveMap({ points, follow, initial, markers }: Props) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const html = useMemo(() => mapDocument(MAPBOX_TOKEN), []);
  const payload = useMemo(
    () => JSON.stringify({ points, follow: follow ?? null, initial: initial ?? null, markers: markers ?? [] }),
    [points, follow, initial, markers],
  );

  useEffect(() => {
    if (!ready.current) return;
    webRef.current?.injectJavaScript(`window.updateDrive(${payload}); true;`);
  }, [payload]);

  if (!MAPBOX_TOKEN) {
    return (
      <View style={styles.fill}>
        <RouteSketch points={points} fill />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.fill}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          ready.current = true;
          webRef.current?.injectJavaScript(`window.updateDrive(${payload}); true;`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
});
