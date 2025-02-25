import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import Button from "@/components/ui/button";

export const ThemeToggle = (props) => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      size="md"
      variant="ghost"
      {...props}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
};
