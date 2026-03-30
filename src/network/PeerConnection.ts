import Peer, { DataConnection } from "peerjs";
import { Message, encodeMessage, decodeMessage } from "./Protocol";

interface PeerHandlers {
  onMessage: (msg: Message) => void;
  onStatus: (status: string) => void;
  onDisconnect: () => void;
}

export class PeerConnection {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private handlers: PeerHandlers | null = null;

  setHandlers(handlers: PeerHandlers): void {
    this.handlers = handlers;
  }

  initPeer(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on("open", (id) => {
        this.handlers?.onStatus("Peer ready");
        this.setupIncoming();
        resolve(id);
      });

      this.peer.on("error", (err) => {
        reject(err);
      });
    });
  }

  private setupIncoming(): void {
    this.peer?.on("connection", (conn) => {
      this.conn = conn;
      this.setupConnection();
    });
  }

  connectToPeer(peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        this.peer = new Peer();

        this.peer.on("open", () => {
          this.doConnect(peerId, resolve, reject);
        });

        this.peer.on("error", (err) => reject(err));
      } else {
        this.doConnect(peerId, resolve, reject);
      }
    });
  }

  private doConnect(
    peerId: string,
    resolve: () => void,
    reject: (err: Error) => void
  ): void {
    const conn = this.peer!.connect(peerId, { reliable: true });
    this.conn = conn;

    const timeout = setTimeout(() => {
      reject(new Error("Connection timed out"));
    }, 10000);

    conn.on("open", () => {
      clearTimeout(timeout);
      this.setupConnection();
      resolve();
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  }

  private setupConnection(): void {
    if (!this.conn) return;

    this.conn.on("data", (data) => {
      const msg = decodeMessage(data as string);
      if (msg) {
        this.handlers?.onMessage(msg);
      }
    });

    this.conn.on("close", () => {
      this.handlers?.onDisconnect();
    });

    this.handlers?.onStatus("Connected!");
  }

  send(msg: Message): void {
    if (this.conn?.open) {
      this.conn.send(encodeMessage(msg));
    }
  }

  destroy(): void {
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
  }
}
