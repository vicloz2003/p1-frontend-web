import { inject, Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly auth = inject(AuthService);

  private client!: Client;

  constructor() {
    setTimeout(() => this.initClient(), 0);
  }

  private initClient(): void {
    const token = this.auth.getAccessToken();
    console.log('[WS] Initializing with token:', token ? token.substring(0, 20) + '...' : 'EMPTY');

    this.client = new Client({
      webSocketFactory: () => new (SockJS as unknown as new (url: string) => object)('http://localhost:3000/ws'),
      reconnectDelay: 5000,
      onConnect: () => console.log('[WS] Connected successfully'),
      onDisconnect: () => console.log('[WS] Disconnected'),
      onStompError: frame => console.error('[WS] STOMP error', frame),
    });

    this.client.beforeConnect = () => {
      this.client.connectHeaders = {
        Authorization: `Bearer ${this.auth.getAccessToken()}`,
      };
    };

    this.client.activate();
  }

  subscribe<T>(topic: string): Observable<T> {
    return new Observable(observer => {
      const trySubscribe = (): (() => void) => {
        if (this.client?.connected) {
          const sub = this.client.subscribe(topic, (msg: IMessage) =>
            observer.next(JSON.parse(msg.body) as T)
          );
          return () => sub.unsubscribe();
        } else {
          const timer = setTimeout(trySubscribe, 500);
          return () => clearTimeout(timer);
        }
      };
      return trySubscribe();
    });
  }
}
