declare module "@nozbe/watermelondb/DatabaseProvider" {
  import { Database } from "@nozbe/watermelondb";
    import { ComponentType, ReactNode } from "react";

  export interface DatabaseProviderProps {
    database: Database;
    children?: ReactNode;
  }

  const DatabaseProvider: ComponentType<DatabaseProviderProps>;
  export default DatabaseProvider;
}
