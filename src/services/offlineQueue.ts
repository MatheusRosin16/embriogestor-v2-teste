const QUEUE_KEY='embriogestor2_offline_queue'

export type OfflineQueueItem={id:string;createdAt:string;kind:'LOCAL_CHANGE'}

function read():OfflineQueueItem[]{
  try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch{return []}
}
export function offlineQueueCount(){return read().length}
export function queueLocalChange(){
  if(navigator.onLine)return
  const q=read()
  if(!q.length)q.push({id:`local-${Date.now()}`,createdAt:new Date().toISOString(),kind:'LOCAL_CHANGE'})
  localStorage.setItem(QUEUE_KEY,JSON.stringify(q))
  window.dispatchEvent(new CustomEvent('embrio-offline-queue'))
}
export function clearOfflineQueue(){
  localStorage.removeItem(QUEUE_KEY)
  window.dispatchEvent(new CustomEvent('embrio-offline-queue'))
}
