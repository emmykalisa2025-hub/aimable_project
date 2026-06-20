import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in, otherwise redirect to login
    const userRole = sessionStorage.getItem("userRole");
    if (!userRole) {
      navigate("/login");
    }
  }, [navigate]);

  return null;
}
