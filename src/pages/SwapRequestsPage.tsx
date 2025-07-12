import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SwapRequest {
  id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
  recipient: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
  offered_skill: {
    id: string;
    name: string;
  };
  wanted_skill: {
    id: string;
    name: string;
  };
}

const SwapRequestsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState<SwapRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<SwapRequest[]>([]);

  useEffect(() => {
    if (user) {
      fetchSwapRequests();
    }
  }, [user]);

  const fetchSwapRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          id,
          message,
          status,
          created_at,
          requester_id,
          recipient_id,
          offered_skill_id,
          wanted_skill_id
        `)
        .or(`requester_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique user IDs and skill IDs
      const userIds = [...new Set([
        ...data?.map(req => req.requester_id) || [],
        ...data?.map(req => req.recipient_id) || []
      ])];

      const skillIds = [...new Set([
        ...data?.map(req => req.offered_skill_id) || [],
        ...data?.map(req => req.wanted_skill_id) || []
      ])];

      // Fetch profiles and skills separately
      const [profilesResult, skillsResult] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
        supabase.from('skills').select('id, name').in('id', skillIds)
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (skillsResult.error) throw skillsResult.error;

      const profilesMap = new Map(profilesResult.data?.map(p => [p.user_id, p]) || []);
      const skillsMap = new Map(skillsResult.data?.map(s => [s.id, s]) || []);

      // Transform data with proper relationships
      const transformedData = data?.map(req => ({
        id: req.id,
        message: req.message,
        status: req.status,
        created_at: req.created_at,
        requester: {
          id: req.requester_id,
          ...profilesMap.get(req.requester_id)
        },
        recipient: {
          id: req.recipient_id,
          ...profilesMap.get(req.recipient_id)
        },
        offered_skill: skillsMap.get(req.offered_skill_id),
        wanted_skill: skillsMap.get(req.wanted_skill_id)
      })) || [];

      const sent = transformedData.filter(req => req.requester.id === user?.id);
      const received = transformedData.filter(req => req.recipient.id === user?.id);

      setSentRequests(sent as SwapRequest[]);
      setReceivedRequests(received as SwapRequest[]);
    } catch (error: any) {
      toast({
        title: "Error loading swap requests",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('swap_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      setReceivedRequests(prev => 
        prev.map(req => 
          req.id === requestId ? { ...req, status } : req
        )
      );

      toast({
        title: `Request ${status}`,
        description: `The swap request has been ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating request",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      setSentRequests(prev => prev.filter(req => req.id !== requestId));

      toast({
        title: "Request deleted",
        description: "The swap request has been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting request",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const RequestCard = ({ request, type }: { request: SwapRequest; type: 'sent' | 'received' }) => {
    const otherUser = type === 'sent' ? request.recipient : request.requester;
    const skillOffered = type === 'sent' ? request.offered_skill : request.wanted_skill;
    const skillWanted = type === 'sent' ? request.wanted_skill : request.offered_skill;

    return (
      <Card key={request.id}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={otherUser.avatar_url} />
                <AvatarFallback>
                  {otherUser.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{otherUser.display_name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(request.status)}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-green-600">
                {type === 'sent' ? 'You offer:' : 'They offer:'}
              </p>
              <Badge variant="secondary">{skillOffered.name}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">
                {type === 'sent' ? 'You want:' : 'They want:'}
              </p>
              <Badge variant="outline">{skillWanted.name}</Badge>
            </div>
          </div>

          {request.message && (
            <div>
              <p className="text-sm font-medium flex items-center">
                <MessageSquare className="h-4 w-4 mr-1" />
                Message:
              </p>
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                {request.message}
              </p>
            </div>
          )}

          {type === 'received' && request.status === 'pending' && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => updateRequestStatus(request.id, 'accepted')}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => updateRequestStatus(request.id, 'rejected')}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
            </div>
          )}

          {type === 'sent' && request.status === 'pending' && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => deleteRequest(request.id)}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Request
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Swap Requests</h1>
        <p className="text-muted-foreground">
          Manage your skill exchange requests
        </p>
      </div>

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">
            Received ({receivedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({sentRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          {receivedRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No swap requests received yet. Make sure your profile is public to receive requests!
                </p>
              </CardContent>
            </Card>
          ) : (
            receivedRequests.map((request) => (
              <RequestCard key={request.id} request={request} type="received" />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {sentRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No swap requests sent yet. Start by searching for people with skills you want to learn!
                </p>
              </CardContent>
            </Card>
          ) : (
            sentRequests.map((request) => (
              <RequestCard key={request.id} request={request} type="sent" />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SwapRequestsPage;