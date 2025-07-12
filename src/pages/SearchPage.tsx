import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, MapPin, Send } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  location: string;
  avatar_url: string;
  availability: string;
  offeredSkills: Array<{ id: string; name: string }>;
}

interface MySkill {
  id: string;
  name: string;
  skill_type: 'offered' | 'wanted';
}

const SearchPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [mySkills, setMySkills] = useState<MySkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [swapRequest, setSwapRequest] = useState({
    offeredSkillId: '',
    wantedSkillId: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMySkills();
    }
  }, [user]);

  const fetchMySkills = async () => {
    try {
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          skills (
            id,
            name
          ),
          skill_type
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      const formattedSkills = data?.map(item => ({
        id: item.skills.id,
        name: item.skills.name,
        skill_type: item.skill_type as 'offered' | 'wanted'
      })) || [];

      setMySkills(formattedSkills);
    } catch (error: any) {
      console.error('Error fetching skills:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      // First get matching skills
      const { data: matchingSkills, error: skillsError } = await supabase
        .from('skills')
        .select('id')
        .ilike('name', `%${searchTerm}%`);

      if (skillsError) throw skillsError;

      if (!matchingSkills || matchingSkills.length === 0) {
        setUsers([]);
        return;
      }

      const skillIds = matchingSkills.map(skill => skill.id);

      // Then get user skills that match
      const { data: userSkills, error: userSkillsError } = await supabase
        .from('user_skills')
        .select('user_id')
        .eq('skill_type', 'offered')
        .in('skill_id', skillIds);

      if (userSkillsError) throw userSkillsError;

      const userIds = [...new Set(userSkills?.map(us => us.user_id) || [])];

      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      // Get profiles for these users
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          display_name,
          location,
          avatar_url,
          availability
        `)
        .eq('is_public', true)
        .neq('user_id', user?.id)
        .in('user_id', userIds);

      if (error) throw error;

      // Get all offered skills for these users
      const { data: allUserSkills, error: allSkillsError } = await supabase
        .from('user_skills')
        .select(`
          user_id,
          skills (
            id,
            name
          )
        `)
        .eq('skill_type', 'offered')
        .in('user_id', userIds);

      if (allSkillsError) throw allSkillsError;

      if (error) throw error;

      // Group skills by user
      const userMap = new Map<string, UserProfile>();
      
      data?.forEach(profile => {
        if (!userMap.has(profile.user_id)) {
          userMap.set(profile.user_id, {
            id: profile.id,
            user_id: profile.user_id,
            display_name: profile.display_name,
            location: profile.location,
            avatar_url: profile.avatar_url,
            availability: profile.availability,
            offeredSkills: []
          });
        }
      });

      // Add skills to user profiles
      allUserSkills?.forEach((userSkill: any) => {
        const userProfile = userMap.get(userSkill.user_id);
        if (userProfile && userSkill.skills) {
          if (!userProfile.offeredSkills.find(s => s.id === userSkill.skills.id)) {
            userProfile.offeredSkills.push(userSkill.skills);
          }
        }
      });

      setUsers(Array.from(userMap.values()));
    } catch (error: any) {
      toast({
        title: "Error searching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendSwapRequest = async () => {
    if (!swapRequest.offeredSkillId || !swapRequest.wantedSkillId) {
      toast({
        title: "Please select skills",
        description: "You must select both skills for the swap.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('swap_requests')
        .insert({
          requester_id: user?.id,
          recipient_id: selectedUser?.user_id,
          offered_skill_id: swapRequest.offeredSkillId,
          wanted_skill_id: swapRequest.wantedSkillId,
          message: swapRequest.message
        });

      if (error) throw error;

      toast({
        title: "Swap request sent!",
        description: "Your request has been sent successfully.",
      });

      setSelectedUser(null);
      setSwapRequest({ offeredSkillId: '', wantedSkillId: '', message: '' });
    } catch (error: any) {
      toast({
        title: "Error sending request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const myOfferedSkills = mySkills.filter(s => s.skill_type === 'offered');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Find Skill Partners</h1>
        <p className="text-muted-foreground">
          Search for people who can teach you new skills
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search for skills (e.g., guitar, cooking, programming)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                searchUsers();
              }
            }}
          />
        </div>
        <Button onClick={searchUsers} disabled={loading || !searchTerm.trim()}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((userProfile) => (
          <Card key={userProfile.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={userProfile.avatar_url} />
                  <AvatarFallback>
                    {userProfile.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{userProfile.display_name}</CardTitle>
                  {userProfile.location && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 mr-1" />
                      {userProfile.location}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Offers:</p>
                <div className="flex flex-wrap gap-1">
                  {userProfile.offeredSkills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="text-xs">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
              {userProfile.availability && (
                <div>
                  <p className="text-sm font-medium">Availability:</p>
                  <p className="text-sm text-muted-foreground">{userProfile.availability}</p>
                </div>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => setSelectedUser(userProfile)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Swap Request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Swap Request</DialogTitle>
                    <DialogDescription>
                      Request a skill swap with {userProfile.display_name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Skill I'll offer:</Label>
                      <Select value={swapRequest.offeredSkillId} onValueChange={(value) => 
                        setSwapRequest(prev => ({ ...prev, offeredSkillId: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill you offer" />
                        </SelectTrigger>
                        <SelectContent>
                          {myOfferedSkills.map((skill) => (
                            <SelectItem key={skill.id} value={skill.id}>
                              {skill.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Skill I want to learn:</Label>
                      <Select value={swapRequest.wantedSkillId} onValueChange={(value) => 
                        setSwapRequest(prev => ({ ...prev, wantedSkillId: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill they offer" />
                        </SelectTrigger>
                        <SelectContent>
                          {userProfile.offeredSkills.map((skill) => (
                            <SelectItem key={skill.id} value={skill.id}>
                              {skill.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Message (Optional):</Label>
                      <Textarea
                        placeholder="Add a personal message..."
                        value={swapRequest.message}
                        onChange={(e) => setSwapRequest(prev => ({ ...prev, message: e.target.value }))}
                      />
                    </div>

                    <Button onClick={sendSwapRequest} disabled={sending} className="w-full">
                      {sending ? "Sending..." : "Send Request"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>

      {searchTerm && users.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No users found with the skill "{searchTerm}". Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;