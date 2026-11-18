declare module "rrweb-player" {
  type PlayerOptions = {
    target: HTMLElement;
    props: {
      events: unknown[];
      width?: number;
      height?: number;
      autoPlay?: boolean;
      showController?: boolean;
    };
  };

  export default class rrwebPlayer {
    constructor(options: PlayerOptions);
    $destroy?: () => void;
  }
}

declare module "rrweb-player/dist/style.css";
