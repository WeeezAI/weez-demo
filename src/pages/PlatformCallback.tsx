import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PlatformCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // After backend saves the token, simply redirect user back to chat
    navigate("/spaces");
  }, []);

  return <div className="p-10 text-center">Connecting platform...</div>;
};

export default PlatformCallback;
