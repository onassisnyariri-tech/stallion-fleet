import { createClient } from '@supabase/supabase-js';

// Replace these with the actual values from your Supabase API settings
const supabaseUrl = 'https://kyfjomajddrlvtvrphhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZmpvbWFqZGRybHZ0dnJwaGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzQ0NjAsImV4cCI6MjA5NTIxMDQ2MH0.GKBBepiVBSziSLxKBWLUpx3pQb97S45YLZ-qRnfAYu8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);