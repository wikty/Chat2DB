import { EventSourcePolyfill } from 'event-source-polyfill';
import { SSE } from 'sse.js';

const connectToEventSource = ({url, uid, onMessage, onError, method = "GET", payload = {} }: { url: string; uid: string; onMessage: Function; onError: Function; method?: string; payload?: object; }) => {
//const connectToEventSource = (params: { url: string; uid: string; onMessage: Function; onError: Function }) => {
  //const { url, uid, onMessage, onError } = params;

  if (!url || !onMessage || !onError) {
    throw new Error('url, onMessage, and onError are required');
  }

  const DBHUB = localStorage.getItem('DBHUB');
  const p = method == "POST" ? {
    headers: {
      uid,
      DBHUB,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(payload),
  } : {
    headers: {
      uid,
      DBHUB,
    },
  };

  // Just can request via GET
  //const eventSource = new EventSourcePolyfill(`${window._BaseURL}${url}`, p);

  // https://github.com/mpetazzoni/sse.js
  const eventSource = new SSE(`${window._BaseURL}${url}`, p);

  eventSource.onmessage = (event) => {
    console.log('onmessage', event);
    onMessage(event.data);
  };

  eventSource.onerror = (error) => {
    onError(error);
    console.error('EventSourcePolyfill error:', error);
  };

  // 返回一个关闭 eventSource 的函数，以便在需要时调用它
  return () => {
    eventSource.close();
  };
};

export default connectToEventSource;
