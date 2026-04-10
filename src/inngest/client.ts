import { Inngest } from "inngest";

/**
 * Typed event map — v3 approach.
 *
 * In Inngest v3, EventSchemas was REMOVED. [web:120]
 * Events are typed by passing a generic to `new Inngest<{ events: Events }>()`.
 * This gives full TypeScript intellisense on event names and data shapes
 * without any external class.
 */
export type Events = {
  "bookmark/added": {
    data: {
      bookmarkId: string;
      url:        string;
      title:      string;
      userId:     string;
    };
  };
};

export const inngest = new Inngest<{ events: Events }>({
  id: "smart-bookmark",
});