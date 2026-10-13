import { useState, useEffect } from "react";
import { apiService } from "./api-service";

// Personnel with fleet access may register vehicles/drivers, but only Admins and
// leads may edit or archive them (mirrors CanManageFleet on the backend).
export function useCanModifyFleet() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    apiService
      .getCurrentUser()
      .then((user) => setAllowed(!!user && user.role !== "PERSONNEL"))
      .catch(() => setAllowed(false));
  }, []);
  return allowed;
}
