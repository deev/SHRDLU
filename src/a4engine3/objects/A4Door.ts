class A4Door extends A4Object {

	constructor(sort:Sort, ID:string, closed:boolean, consumeKey:boolean, 
                a_closed:A4Animation, a_open:A4Animation)
    {
        super("door", sort);
        this.doorID = ID;
        this.closed = closed;
        this.consumeKey = consumeKey;
        this.interacteable = true;
        this.animations[A4_ANIMATION_CLOSED] = a_closed;
        this.animations[A4_ANIMATION_OPEN] = a_open;
        if (this.closed) this.currentAnimation = A4_ANIMATION_CLOSED;
                    else this.currentAnimation = A4_ANIMATION_OPEN;
    }


    loadObjectAttribute(attribute_xml:Element) : boolean
    {
        if (super.loadObjectAttribute(attribute_xml)) return true;
        var a_name:string = attribute_xml.getAttribute("name");
        
        if (a_name == "doorID") {
            this.doorID = attribute_xml.getAttribute("value");
            return true;
        } else if (a_name == "doorgroup") {
            this.doorGroupID = attribute_xml.getAttribute("value");
            return true;
        } else if (a_name == "closed") {
            this.closed = false;
            if (attribute_xml.getAttribute("value") == "true") this.closed = true;
            if (this.closed) this.currentAnimation = A4_ANIMATION_CLOSED;
                        else this.currentAnimation = A4_ANIMATION_OPEN;
            return true;
        } else if (a_name == "consumeKey") {
            this.consumeKey = false;
            if (attribute_xml.getAttribute("value") == "true") this.consumeKey = true;
            return true;
        } else if (a_name == "automatic") {
            this.automatic = false;
            if (attribute_xml.getAttribute("value") == "true") this.automatic = true;
            return true;
        }

        return false;
    }


    savePropertiesToXML(game:A4Game) : string
    {
        var xmlString:string = super.savePropertiesToXML(game);

        if (this.doorID!=null) xmlString += this.saveObjectAttributeToXML("doorID",this.doorID) + "\n";
        if (this.doorGroupID!=null) xmlString += this.saveObjectAttributeToXML("doorgroup",this.doorGroupID) + "\n";
        xmlString += this.saveObjectAttributeToXML("closed",this.closed) + "\n";
        xmlString += this.saveObjectAttributeToXML("consumeKey",this.consumeKey) + "\n";
        xmlString += this.saveObjectAttributeToXML("automatic",this.automatic) + "\n";

        return xmlString;
    }


	isWalkable() : boolean 
    {
        return !this.closed;
    }


    update(game:A4Game) : boolean
    {
        var ret:boolean = super.update(game);
    
        if (this.automatic) {
            // do not check every frame
            this.automaticTimmer--;
            if (this.automaticTimmer<=0) {
                var radius:number = 2;
                var x1:number = this.x-radius*this.map.tileWidth;
                var dx:number = this.getPixelWidth()+(2*radius)*this.map.tileWidth;
                var y1:number = this.y+this.tallness-radius*this.map.tileHeight;
                var dy:number = (this.getPixelHeight()-this.tallness)+(2*radius)*this.map.tileHeight;

                var l:A4Object[] = this.map.getAllObjects(x1,y1,dx,dy);
                var characterAround:A4Character = null;
                for(let o of l) {
                    if (o.isCharacter()) {
                        characterAround = <A4Character>o;
                        break;
                    }
                }

                if (this.closed) {
                    if (characterAround!=null) {
                        this.changeStateRecursively(false, characterAround, this.map, game);
                    }
                } else {
                    if (characterAround==null) {
                        this.changeStateRecursively(true, null, this.map, game);
                    }
                }

                this.automaticTimmer = 8;
            } 
        }

        return ret;
    }


    event(a_event:number, character:A4Character, map:A4Map, game:A4Game)
    {
        super.event(a_event,character,map,game);

        if (a_event == A4_EVENT_INTERACT) {
            if (this.consumeKey && !this.closed) return;  // if it consumes the key, it cannot be reopened!

            var match:boolean = false;
            if (this.doorID == null) {
                // if it does not require key, then just open/close directly
                match = true;
            }

            // see if the character has the key:
            for(let o of character.inventory) {
                if (o.isKey()) {
                    var key:A4Key = <A4Key>o;
                    if (key.keyID == this.doorID ||
                        key.keyID == "MASTERKEY") {
                        // the player has the proper key!
                        match = true;
                        break;
                    }
                }
            }

            if (match) {
                if (this.checkForBlockages(!this.closed, character, map, game, [])) {
                    // change all the doors in the same doorgroup:
                    if (this.doorGroupID==null) {
                        this.changeStateRecursively(!this.closed, character, map, game);
                        if (this.consumeKey) {
                            character.removeFromInventory(key);
                            game.requestDeletion(key);
                        }
                    } else {
                        if (game.checkIfDoorGroupStateCanBeChanged(this.doorGroupID, this.closed, character)) {
                            this.changeStateRecursively(!this.closed, character, map, game);
                            game.setDoorGroupState(this.doorGroupID, this.closed, character);
                            if (this.consumeKey) {
                                character.removeFromInventory(key);
                                game.requestDeletion(key);
                            }
                        }
                    }
                }                
            }
        }
    }


    eventWithID(a_event:number, ID:string, character:A4Character, map:A4Map, game:A4Game)
    {
        super.eventWithID(a_event,ID,character,map,game);

        if (a_event == A4_EVENT_OPEN && this.doorID == ID) {
            if (this.eventScripts[a_event]!=null) {
                for(let rule of this.eventScripts[a_event]) {
                    rule.executeEffects(this, map, game, character);
                }
            }

            this.closed = (this.closed ? false:true);
            if (this.closed) {
                this.currentAnimation = A4_ANIMATION_CLOSED;
                this.event(A4_EVENT_CLOSE,character,map,game);
            } else {
                this.currentAnimation = A4_ANIMATION_OPEN;
                this.event(A4_EVENT_OPEN,character,map,game);
            }
            if (this.animations[this.currentAnimation]!=null) this.animations[this.currentAnimation].reset();

//            if (character!=null) {
//            map.reevaluateVisibilityRequest();
//            }
        }
    }

  
    isDoor() : boolean
    {
        return true;
    }
  

    changeStateRecursively(closed:boolean, character:A4Character, map:A4Map, game:A4Game)
    {
        if (this.closed==closed) return;

        this.eventWithID(A4_EVENT_OPEN, this.doorID, character, map, game);

        // for the SHRDLU game, I commented this code out, since we never have two adjacent doors I want to open at the same time
        /*
        var dx1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelWidth());
        var dy1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelHeight());
        var dx2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelWidth());
        var dy2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelHeight());

        var dx:number = (dx1>dx2 ? dx1:dx2);
        var dy:number = (dy1>dy2 ? dy1:dy2);

        for(let i:number = 0;i<A4_NDIRECTIONS;i++) {
            var l:A4Object[] = this.map.getAllObjects(this.x+direction_x_inc[i], this.y+direction_y_inc[i], dx, dy);

            for(let o of l) {
                if (o!=this && o.isDoor()) {
                    var door:A4Door = <A4Door>o;
                    if (door.doorID == this.doorID) door.changeStateRecursively(closed, character, map, game);
                }
            }
        }
        */
    }


    checkForBlockages(closed:boolean, character:A4Character, map:A4Map, game:A4Game, alreadyVisited:A4Door[]) : boolean
    {
        if (closed) {
            for(let d of alreadyVisited) {
                if (this == d) return true;
            }
            alreadyVisited.push(this);
            
            // closing the doors:
            var blockage:boolean = false;
            var l:A4Object[] = this.map.getAllObjectCollisions(this);
            for(let caught of l) {
                if (caught.isCharacter()) {
                    blockage = true;
                } else if (caught.isVehicle()) {
                    blockage = true;
                }
            }

            var dx1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelWidth());
            var dy1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelHeight());
            var dx2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelWidth());
            var dy2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelHeight());

            var dx:number = (dx1>dx2 ? dx1:dx2);
            var dy:number = (dy1>dy2 ? dy1:dy2);
            for(let i:number = 0;i<A4_NDIRECTIONS;i++) {
                var l:A4Object[] = this.map.getAllObjects(this.x+direction_x_inc[i], this.y+direction_y_inc[i], dx, dy);
                
                for(let o of l) {
                    if (o!=this && o.isDoor()) {
                        var door:A4Door = <A4Door>o;
                        if (door.doorID == this.doorID) {
                            if (!door.checkForBlockages(closed, character, map, game, alreadyVisited)) {
                                blockage = true;
                            }
                        }
                    }
                }                
            }
            
            return !blockage;
        } else {
            // opening the doors:
            return true;
        }
    }


    getPixelWidth() : number
    {
        if (this.pixel_width_cache_cycle == this.cycle) return this.pixel_width_cache;
        var dx1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelWidth());
        var dy1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelHeight());
        var dx2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelWidth());
        var dy2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelHeight());
        var dx:number = (dx1>dx2 ? dx1:dx2);
        var dy:number = (dy1>dy2 ? dy1:dy2);
        this.pixel_width_cache = dx;
        this.pixel_height_cache = dy;
        this.pixel_width_cache_cycle = this.cycle;
        return this.pixel_width_cache;
    }


    getPixelHeight() : number
    {
        if (this.pixel_width_cache_cycle == this.cycle) return this.pixel_height_cache;
        var dx1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelWidth());
        var dy1:number = (this.animations[A4_ANIMATION_CLOSED]==null ? 0:this.animations[A4_ANIMATION_CLOSED].getPixelHeight());
        var dx2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelWidth());
        var dy2:number = (this.animations[A4_ANIMATION_OPEN]==null ? 0:this.animations[A4_ANIMATION_OPEN].getPixelHeight());
        var dx:number = (dx1>dx2 ? dx1:dx2);
        var dy:number = (dy1>dy2 ? dy1:dy2);
        this.pixel_width_cache = dx;
        this.pixel_height_cache = dy;
        this.pixel_width_cache_cycle = this.cycle;
        return this.pixel_height_cache;
    }


	doorID:string;
    doorGroupID:string = null;
	closed:boolean = true;
    consumeKey:boolean = true;
    automatic:boolean = false;
    automaticTimmer:number = 0;
}