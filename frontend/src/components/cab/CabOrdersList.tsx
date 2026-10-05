import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Car,
  Bike,
  Truck,
  Bus,
  Package,
  Navigation,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Volume2,
  RefreshCw,
  Loader2,
  MapPin,
  ArrowRight,
} from "lucide-react";

export interface CabOrder {
  id: string;
  order_code: string;
  service_type: "transport" | "delivery";
  customer_name: string;
  customer_phone: string;
  vehicle_type: string;
  pickup_address: string;
  dropoff_address: string;
  trip_type?: "one_way" | "round_trip";
  delivery_items?: string;
  distance_km: number;
  total_fare: number;
  status: "pending" | "assigned" | "confirmed" | "completed" | "cancelled";
  assigned_voice_url?: string;
  created_at: string;
}

export default function CabOrdersList() {
  const [orders, setOrders] = useState<CabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch cab orders error:", error);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      console.error("Load orders error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: CabOrder["status"]) => {
    try {
      const { error } = await supabase
        .schema("central_cab")
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      toast({
        title: "Order Status Updated",
        description: `Order marked as ${newStatus}.`,
      });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Confirmed</Badge>;
      case "assigned":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Assigned</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-muted-foreground border-muted-foreground">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">Pending Driver</Badge>;
    }
  };

  const formatLKR = (amount: number) => {
    return `LKR ${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Ceylon Central Cabs & Delivery Bookings
            </CardTitle>
            <CardDescription className="text-xs">
              Live customer ride & delivery requests with distance calculations and driver voice updates.
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            variant="outline"
            size="sm"
            disabled={refreshing || loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Car className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold">No Bookings Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Incoming customer WhatsApp bookings for Cabs and Delivery will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type & Vehicle</TableHead>
                  <TableHead>Route (Pickup → Drop)</TableHead>
                  <TableHead>Distance & Fare</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Voice Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono font-bold text-primary">
                      {order.order_code}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-sm">{order.customer_name}</div>
                      <a
                        href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-emerald-600 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {order.customer_phone}
                      </a>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {order.service_type === "delivery" ? (
                          <Package className="h-3.5 w-3.5 text-purple-600" />
                        ) : (
                          <Car className="h-3.5 w-3.5 text-blue-600" />
                        )}
                        <span className="capitalize">{order.service_type}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.vehicle_type}
                        {order.trip_type === "round_trip" && " (Round Trip)"}
                      </div>
                      {order.delivery_items && (
                        <div className="text-[11px] text-muted-foreground/80 italic mt-0.5 line-clamp-1">
                          Items: {order.delivery_items}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[220px]">
                      <div className="text-xs flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate" title={order.pickup_address}>
                          {order.pickup_address}
                        </span>
                      </div>
                      <div className="text-xs flex items-center gap-1 text-muted-foreground mt-0.5">
                        <ArrowRight className="h-3 w-3 text-red-500 shrink-0" />
                        <span className="truncate" title={order.dropoff_address}>
                          {order.dropoff_address}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-semibold">{formatLKR(order.total_fare)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.distance_km} KM
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(order.status)}</TableCell>

                    <TableCell>
                      {order.assigned_voice_url ? (
                        <audio
                          controls
                          src={order.assigned_voice_url}
                          className="h-7 w-36 max-w-full"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right space-x-1">
                      {order.status === "pending" && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, "confirmed")}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        >
                          Confirm
                        </Button>
                      )}
                      {order.status === "confirmed" && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, "completed")}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
