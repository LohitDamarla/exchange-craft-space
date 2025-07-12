import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Star, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AcceptedSwapRequest {
  id: string;
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
  created_at: string;
  has_feedback: boolean;
}

interface Feedback {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
  reviewee: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
}

const FeedbackPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [acceptedSwaps, setAcceptedSwaps] = useState<AcceptedSwapRequest[]>([]);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);
  const [feedbackForm, setFeedbackForm] = useState({
    swapRequestId: '',
    revieweeId: '',
    rating: '',
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAcceptedSwaps();
      fetchMyFeedback();
    }
  }, [user]);

  const fetchAcceptedSwaps = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          id,
          created_at,
          requester_id,
          recipient_id,
          offered_skill_id,
          wanted_skill_id
        `)
        .eq('status', 'accepted')
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

      // Check which swaps already have feedback from this user
      const swapIds = data?.map(swap => swap.id) || [];
      const { data: existingFeedback } = await supabase
        .from('feedback')
        .select('swap_request_id')
        .in('swap_request_id', swapIds)
        .eq('reviewer_id', user?.id);

      const feedbackSwapIds = new Set(existingFeedback?.map(f => f.swap_request_id) || []);

      // Transform data with proper relationships
      const swapsWithFeedbackStatus = data?.map(swap => ({
        id: swap.id,
        created_at: swap.created_at,
        requester: {
          id: swap.requester_id,
          ...profilesMap.get(swap.requester_id)
        },
        recipient: {
          id: swap.recipient_id,
          ...profilesMap.get(swap.recipient_id)
        },
        offered_skill: skillsMap.get(swap.offered_skill_id),
        wanted_skill: skillsMap.get(swap.wanted_skill_id),
        has_feedback: feedbackSwapIds.has(swap.id)
      })) || [];

      setAcceptedSwaps(swapsWithFeedbackStatus as AcceptedSwapRequest[]);
    } catch (error: any) {
      toast({
        title: "Error loading swaps",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMyFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer_id,
          reviewee_id
        `)
        .eq('reviewee_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set([
        ...data?.map(f => f.reviewer_id) || [],
        ...data?.map(f => f.reviewee_id) || []
      ])];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Transform data with proper relationships
      const transformedFeedback = data?.map(feedback => ({
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        created_at: feedback.created_at,
        reviewer: {
          id: feedback.reviewer_id,
          ...profilesMap.get(feedback.reviewer_id)
        },
        reviewee: {
          id: feedback.reviewee_id,
          ...profilesMap.get(feedback.reviewee_id)
        }
      })) || [];

      setMyFeedback(transformedFeedback as Feedback[]);
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackForm.rating || !feedbackForm.revieweeId) {
      toast({
        title: "Please complete the form",
        description: "Rating is required to submit feedback.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          swap_request_id: feedbackForm.swapRequestId,
          reviewer_id: user?.id,
          reviewee_id: feedbackForm.revieweeId,
          rating: parseInt(feedbackForm.rating),
          comment: feedbackForm.comment
        });

      if (error) throw error;

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback.",
      });

      setFeedbackForm({
        swapRequestId: '',
        revieweeId: '',
        rating: '',
        comment: ''
      });

      // Refresh the data
      fetchAcceptedSwaps();
      fetchMyFeedback();
    } catch (error: any) {
      toast({
        title: "Error submitting feedback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingFeedback = acceptedSwaps.filter(swap => !swap.has_feedback);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Feedback & Reviews</h1>
        <p className="text-muted-foreground">
          Share your experience and see what others say about you
        </p>
      </div>

      {/* Give Feedback Section */}
      {pendingFeedback.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Give Feedback</CardTitle>
            <CardDescription>
              Rate your recent skill exchange experiences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select a completed swap to review:</Label>
              <Select
                value={feedbackForm.swapRequestId}
                onValueChange={(value) => {
                  const swap = acceptedSwaps.find(s => s.id === value);
                  if (swap) {
                    const otherUser = swap.requester.id === user?.id ? swap.recipient : swap.requester;
                    setFeedbackForm(prev => ({
                      ...prev,
                      swapRequestId: value,
                      revieweeId: otherUser.id
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a swap to review" />
                </SelectTrigger>
                <SelectContent>
                  {pendingFeedback.map((swap) => {
                    const otherUser = swap.requester.id === user?.id ? swap.recipient : swap.requester;
                    const mySkill = swap.requester.id === user?.id ? swap.offered_skill : swap.wanted_skill;
                    const theirSkill = swap.requester.id === user?.id ? swap.wanted_skill : swap.offered_skill;
                    
                    return (
                      <SelectItem key={swap.id} value={swap.id}>
                        {otherUser.display_name} - {mySkill.name} ↔ {theirSkill.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {feedbackForm.swapRequestId && (
              <>
                <div className="space-y-2">
                  <Label>Rating (1-5 stars):</Label>
                  <Select
                    value={feedbackForm.rating}
                    onValueChange={(value) => setFeedbackForm(prev => ({ ...prev, rating: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <SelectItem key={rating} value={rating.toString()}>
                          <div className="flex items-center space-x-2">
                            <span>{rating}</span>
                            <div className="flex">
                              {renderStars(rating)}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Comment (Optional):</Label>
                  <Textarea
                    placeholder="Share your experience..."
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                  />
                </div>

                <Button onClick={submitFeedback} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Received Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback About You</CardTitle>
          <CardDescription>
            See what others are saying about your skills and teaching
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myFeedback.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No feedback received yet. Complete some skill swaps to start receiving reviews!
            </p>
          ) : (
            <div className="space-y-4">
              {myFeedback.map((feedback) => (
                <div key={feedback.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={feedback.reviewer.avatar_url} />
                        <AvatarFallback>
                          {feedback.reviewer.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{feedback.reviewer.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  {feedback.comment && (
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground" />
                      <p className="text-sm">{feedback.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackPage;