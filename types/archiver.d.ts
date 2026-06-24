declare module 'archiver' {
  import { Readable, Transform } from 'stream';

  interface EntryData {
    name: string;
    type?: 'directory' | 'file' | 'symlink';
    date?: Date | string;
    mode?: number;
    prefix?: string;
  }

  export class Archiver extends Transform {
    append(source: string | Buffer | Readable, data?: EntryData): this;
    directory(dirpath: string, destpath: string | false): this;
    file(filepath: string, data?: EntryData): this;
    finalize(): Promise<void>;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    on(event: string, listener: (...args: any[]) => void): this;
    pointer(): number;
  }

  interface ArchiverOptions {
    zlib?: { level?: number };
    gzip?: boolean;
    [key: string]: any;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }
  export class TarArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }
  export class JsonArchive extends Archiver {
    constructor(options?: ArchiverOptions);
  }
}
