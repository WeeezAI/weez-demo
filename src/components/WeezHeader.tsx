import { Sparkles } from "lucide-react";

const WeezHeader = () => {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-primary rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Weez AI</h1>
            <p className="text-sm text-muted-foreground">Demo Assistant</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default WeezHeader;