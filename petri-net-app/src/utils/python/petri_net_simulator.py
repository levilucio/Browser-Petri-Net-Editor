"""
Petri Net Simulator Engine
This module provides functions to simulate Petri nets, including:
- Computing enabled transitions
- Firing transitions
- Updating markings
"""

class PetriNetSimulator:
    """
    A simulator for Petri nets that computes enabled transitions and updates markings.
    """
    
    def __init__(self, petri_net):
        """
        Initialize the simulator with a Petri net.
        
        Args:
            petri_net (dict): The Petri net in JSON format with places, transitions, and arcs
        """
        self.petri_net = petri_net
        self.places = petri_net.get('places', [])
        self.transitions = petri_net.get('transitions', [])
        self.arcs = petri_net.get('arcs', [])
        
    def get_input_places(self, transition_id):
        """
        Get all input places for a transition.
        
        Args:
            transition_id (str): The ID of the transition
            
        Returns:
            list: List of (place, arc) tuples for all input places
        """
        input_places = []
        
        for arc in self.arcs:
            # Check if the arc is from a place to this transition
            source_id = arc.get('sourceId') or arc.get('source')
            target_id = arc.get('targetId') or arc.get('target')
            source_type = arc.get('sourceType')
            
            # Handle both editor-created arcs and PNML-loaded arcs
            if ((source_type == 'place' and target_id == transition_id) or 
                (arc.get('type') == 'place-to-transition' and target_id == transition_id)):
                # Find the place
                place = next((p for p in self.places if p.get('id') == source_id), None)
                if place:
                    input_places.append((place, arc))
                    
        return input_places
    
    def get_output_places(self, transition_id):
        """
        Get all output places for a transition.
        
        Args:
            transition_id (str): The ID of the transition
            
        Returns:
            list: List of (place, arc) tuples for all output places
        """
        output_places = []
        
        for arc in self.arcs:
            # Check if the arc is from this transition to a place
            source_id = arc.get('sourceId') or arc.get('source')
            target_id = arc.get('targetId') or arc.get('target')
            target_type = arc.get('targetType')
            
            # Handle both editor-created arcs and PNML-loaded arcs
            if ((target_type == 'place' and source_id == transition_id) or 
                (arc.get('type') == 'transition-to-place' and source_id == transition_id)):
                # Find the place
                place = next((p for p in self.places if p.get('id') == target_id), None)
                if place:
                    output_places.append((place, arc))
                    
        return output_places
    
    def is_transition_enabled(self, transition_id):
        """
        Check if a transition is enabled.
        
        Args:
            transition_id (str): The ID of the transition
            
        Returns:
            bool: True if the transition is enabled, False otherwise
        """
        input_places = self.get_input_places(transition_id)
        
        # A transition is enabled if all input places have enough tokens
        for place, arc in input_places:
            # Get the arc weight (default to 1 if not specified)
            weight = arc.get('weight', 1)
            
            # Check if the place has enough tokens
            if place.get('tokens', 0) < weight:
                return False
                
        return True
    
    def get_enabled_transitions(self):
        """
        Get all enabled transitions in the Petri net.
        
        Returns:
            list: List of enabled transition objects
        """
        enabled_transitions = []
        
        for transition in self.transitions:
            if self.is_transition_enabled(transition.get('id')):
                enabled_transitions.append(transition)
                
        return enabled_transitions
    
    def fire_transition(self, transition_id):
        """
        Fire a transition and update the marking.
        
        Args:
            transition_id (str): The ID of the transition to fire
            
        Returns:
            dict: Updated Petri net with new marking
            
        Raises:
            ValueError: If the transition is not enabled
        """
        # Check if the transition is enabled
        if not self.is_transition_enabled(transition_id):
            raise ValueError(f"Transition {transition_id} is not enabled")
            
        # Get input and output places
        input_places = self.get_input_places(transition_id)
        output_places = self.get_output_places(transition_id)
        
        # Create a deep copy of the Petri net to update
        updated_petri_net = {
            'places': [dict(place) for place in self.places],
            'transitions': self.transitions,
            'arcs': self.arcs
        }
        
        # Remove tokens from input places
        for place, arc in input_places:
            weight = arc.get('weight', 1)
            place_id = place.get('id')
            
            # Find the place in the updated Petri net
            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)
            if updated_place:
                updated_place['tokens'] = max(0, updated_place.get('tokens', 0) - weight)
        
        # Add tokens to output places
        for place, arc in output_places:
            weight = arc.get('weight', 1)
            place_id = place.get('id')
            
            # Find the place in the updated Petri net
            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)
            if updated_place:
                # Enforce token limit (20 per place)
                updated_place['tokens'] = min(20, updated_place.get('tokens', 0) + weight)
        
        return updated_petri_net
    
    def compute_reachable_markings(self, max_steps=100):
        """
        Compute all reachable markings from the current marking.
        
        Args:
            max_steps (int): Maximum number of steps to compute
            
        Returns:
            list: List of reachable markings
        """
        # Start with the current marking
        markings = [self._extract_marking()]
        visited_markings = set([self._marking_to_tuple(markings[0])])
        
        # Keep track of the current Petri net state
        current_petri_net = self.petri_net
        
        # Breadth-first search for reachable markings
        steps = 0
        while steps < max_steps:
            steps += 1
            
            # Create a simulator for the current Petri net
            simulator = PetriNetSimulator(current_petri_net)
            
            # Get enabled transitions
            enabled_transitions = simulator.get_enabled_transitions()
            if not enabled_transitions:
                break
                
            # Try firing each enabled transition
            new_markings_found = False
            for transition in enabled_transitions:
                # Fire the transition
                new_petri_net = simulator.fire_transition(transition.get('id'))
                
                # Extract the new marking
                new_marking = self._extract_marking(new_petri_net)
                new_marking_tuple = self._marking_to_tuple(new_marking)
                
                # Check if we've seen this marking before
                if new_marking_tuple not in visited_markings:
                    markings.append(new_marking)
                    visited_markings.add(new_marking_tuple)
                    new_markings_found = True
                    
                    # Update the current Petri net
                    current_petri_net = new_petri_net
            
            # If no new markings were found, we've reached a fixed point
            if not new_markings_found:
                break
                
        return markings
    
    def _extract_marking(self, petri_net=None):
        """
        Extract the current marking from the Petri net.
        
        Args:
            petri_net (dict, optional): The Petri net to extract the marking from.
                If None, use the simulator's Petri net.
                
        Returns:
            dict: Mapping from place ID to token count
        """
        petri_net = petri_net or self.petri_net
        places = petri_net.get('places', [])
        
        marking = {}
        for place in places:
            marking[place.get('id')] = place.get('tokens', 0)
            
        return marking
    
    def _marking_to_tuple(self, marking):
        """
        Convert a marking dict to a tuple for hashing.
        
        Args:
            marking (dict): Mapping from place ID to token count
            
        Returns:
            tuple: Tuple representation of the marking
        """
        return tuple(sorted((k, v) for k, v in marking.items()))
