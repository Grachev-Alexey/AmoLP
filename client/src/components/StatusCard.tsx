import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  status: "connected" | "disconnected" | "pending";
  statusLabel: string;
  value?: string | number;
  iconColor?: string;
}

export default function StatusCard({ 
  icon: Icon, 
  title, 
  description, 
  status, 
  statusLabel, 
  value,
  iconColor = "text-primary"
}: StatusCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "bg-green-500/20 text-green-500";
      case "disconnected":
        return "bg-red-500/20 text-red-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-500";
      default:
        return "bg-primary/20 text-primary";
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case "connected":
        return "status-connected";
      case "disconnected":
        return "status-disconnected";
      case "pending":
        return "status-pending";
      default:
        return "status-disconnected";
    }
  };

  return (
    <Card className="hover-lift transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 ${getStatusColor()} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {value ? (
            <div className="text-2xl font-bold text-foreground">{value}</div>
          ) : (
            <Badge variant="secondary" className={`status-indicator ${getStatusClass()}`}>
              {statusLabel}
            </Badge>
          )}
        </div>
        <div className="mt-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
    </Card>
  );
}
