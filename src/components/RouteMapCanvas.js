import { WebView } from 'react-native-webview';

import { routeMapHtml } from '@/components/routeMapHtml';

export function RouteMapCanvas({ from, to, line }) {
  return (
    <WebView
      style={{ flex: 1, backgroundColor: '#E7EDF6' }}
      originWhitelist={['*']}
      source={{ html: routeMapHtml({ from, to, line }) }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      applicationNameForUserAgent="ViecNhanh/1.0"
    />
  );
}
