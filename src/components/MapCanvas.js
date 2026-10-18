import { WebView } from 'react-native-webview';

import { mapHtml, readMapMessage } from '@/components/mapHtml';

export function MapCanvas({ latitude, longitude, onPin }) {
  return (
    <WebView
      style={{ flex: 1, backgroundColor: '#E7EDF6' }}
      originWhitelist={['*']}
      source={{ html: mapHtml(latitude, longitude) }}
      onMessage={(event) => {
        const point = readMapMessage(event.nativeEvent.data);
        if (point) onPin(point);
      }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      applicationNameForUserAgent="ViecNhanh/1.0"
    />
  );
}
