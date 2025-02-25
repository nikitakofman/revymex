import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

const RevymeIcon = () => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getLogo = () => {
    if (!mounted) return "/revymeicon.svg";
    return theme === "dark" ? "/revymeicon.svg" : "/revymeiconblack.svg";
  };

  return <Image src={getLogo()} width={12} height={12} alt="Revyme Logo" />;
};

export default RevymeIcon;
