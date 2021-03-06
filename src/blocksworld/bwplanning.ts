
var BW_PLANNING_ACTION_TAKE:string = "action.take";
var BW_PLANNING_ACTION_PUT_IN:string = "action.put-in";

class BWPlannerState {

	constructor(bw:ShrdluBlocksWorld)
	{
		this.bw = bw;
	}

	static fromBlocksWorld(bw:ShrdluBlocksWorld) : BWPlannerState
	{
		let s:BWPlannerState = new BWPlannerState(bw);

		s.x = [];
		s.y = [];
		s.z = [];
		for(let o of bw.objects) {
			if (o == bw.objectInArm) {
				s.x.push(o.x);
				s.y.push(10000);
				s.z.push(o.z);
			} else {
				s.x.push(o.x);
				s.y.push(o.y);
				s.z.push(o.z);
			}
		}

		if (bw.objectInArm != null) s.objectInArm = bw.objects.indexOf(bw.objectInArm);

		return s;
	}

	static clone(s0:BWPlannerState) : BWPlannerState
	{
		let s:BWPlannerState = new BWPlannerState(s0.bw);
		s.objectInArm = s0.objectInArm;
		s.x = [...s0.x];
		s.y = [...s0.y];
		s.z = [...s0.z];
		return s;
	}


	checkGoal(goal:PlanningCondition, o:Ontology) : boolean
	{
		for(let conjunct of goal.predicates) {
			if (this.checkConjunct(conjunct, null, 0, o)) return true;
		}
		return false;
	}


	checkConjunct(predicates:PlanningPredicate[], b:Bindings, index:number, o:Ontology) : boolean
	{
		if (index >= predicates.length) return true;
		let term:Term = predicates[index].term;
		if (b != null) term = term.applyBindings(b);			
		if (predicates[index].sign) {
			let possibleBindings:[VariableTermAttribute,TermAttribute][][] = this.checkPredicate(term, o);
			for(let bindings of possibleBindings) {
				let b2:Bindings = b;
				if (bindings.length > 0) {
					b2 = new Bindings();
					if (b == null) {
						b2.l = bindings;
					} else {
						b2.l = b.l.concat(bindings); 
					}
				}
				// recursive call:
				if (this.checkConjunct(predicates, b2, index+1, o)) return true;
			}
			return false;
		} else {
			if (this.checkPredicate(term, o).length > 0) return false;
			return this.checkConjunct(predicates, b, index+1, o);
		}
	}


	checkPredicate(predicate:Term, o:Ontology) : [VariableTermAttribute,TermAttribute][][]
	{
		switch(predicate.functor.name) {
			case "verb.hold":
				{
					if (this.objectInArm == -1) return [];

					let id:TermAttribute = predicate.attributes[1];
					if (id instanceof VariableTermAttribute) {
						return [[[id, new ConstantTermAttribute(this.bw.objects[this.objectInArm].ID, BWPlanner.s_id_sort)]]];
					} else if (id instanceof ConstantTermAttribute) {
						if ((<ConstantTermAttribute>id).value == this.bw.objects[this.objectInArm].ID) {
							return [[]];
						} else {
							return [];
						}
					} else {
						return [];
					}
				}
				break;

			case "space.directly.on.top.of":
				{
					let a1:TermAttribute = predicate.attributes[0];
					let a2:TermAttribute = predicate.attributes[1];
					if ((a1 instanceof ConstantTermAttribute) &&
					    (a2 instanceof ConstantTermAttribute)) {
						let id1:string = (<ConstantTermAttribute>a1).value;
						let id2:string = (<ConstantTermAttribute>a2).value;
						if (this.isOnTopOf(this.bw.idHash[id1], this.bw.idHash[id2])) return [[]];
						return [];
					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof ConstantTermAttribute)) {
						let id2:string = (<ConstantTermAttribute>a2).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx1:number = 0; idx1<this.x.length; idx1++) {
							if (this.isOnTopOf(idx1, this.bw.idHash[id2])) {
								bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx1].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					}  else if ((a1 instanceof ConstantTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let id1:string = (<ConstantTermAttribute>a1).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx2:number = 0; idx2<this.x.length; idx2++) {
							if (this.isOnTopOf(this.bw.idHash[id1], idx2)) {
								bindings.push([[a2, new ConstantTermAttribute(this.bw.objects[idx2].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx1:number = 0; idx1<this.x.length; idx1++) {
							for(let idx2:number = 0; idx2<this.x.length; idx2++) {
								if (this.isOnTopOf(idx1, idx2)) {
									bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx1].ID, BWPlanner.s_id_sort)],
												   [a2, new ConstantTermAttribute(this.bw.objects[idx2].ID, BWPlanner.s_id_sort)]]);
								}
							}
						}
						return bindings;
					}
				}
				break;

			case "space.inside.of":
				{
					let a1:TermAttribute = predicate.attributes[0];
					let a2:TermAttribute = predicate.attributes[1];
					if ((a1 instanceof ConstantTermAttribute) &&
					    (a2 instanceof ConstantTermAttribute)) {
						let id1:string = (<ConstantTermAttribute>a1).value;
						let id2:string = (<ConstantTermAttribute>a2).value;
						if (this.isInsideOf(this.bw.idHash[id1], this.bw.idHash[id2])) return [[]];
						return [];
					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof ConstantTermAttribute)) {
						let id2:string = (<ConstantTermAttribute>a2).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx1:number = 0; idx1<this.x.length; idx1++) {
							if (this.isInsideOf(idx1, this.bw.idHash[id2])) {
								bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx1].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					}  else if ((a1 instanceof ConstantTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let id1:string = (<ConstantTermAttribute>a1).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx2:number = 0; idx2<this.x.length; idx2++) {
							if (this.isInsideOf(this.bw.idHash[id1], idx2)) {
								bindings.push([[a2, new ConstantTermAttribute(this.bw.objects[idx2].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx1:number = 0; idx1<this.x.length; idx1++) {
							for(let idx2:number = 0; idx2<this.x.length; idx2++) {
								if (this.isInsideOf(idx1, idx2)) {
									bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx1].ID, BWPlanner.s_id_sort)],
												   [a2, new ConstantTermAttribute(this.bw.objects[idx2].ID, BWPlanner.s_id_sort)]]);
								}
							}
						}
						return bindings;
					}
				}
				break;

			case SHRDLU_BLOCKTYPE_BLOCK:
			case SHRDLU_BLOCKTYPE_CUBE:
			case SHRDLU_BLOCKTYPE_PYRAMID:
			case SHRDLU_BLOCKTYPE_BOX:
			case SHRDLU_BLOCKTYPE_TABLE:
			case SHRDLU_BLOCKTYPE_ARM:
				{
					let id:TermAttribute = predicate.attributes[0];
					if (id instanceof VariableTermAttribute) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							if (this.bw.objects[idx].type == predicate.functor.name) {
								bindings.push([[id, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					} else if (id instanceof ConstantTermAttribute) {
						if (this.bw.objects[this.bw.idHash[(<ConstantTermAttribute>id).value]].type == predicate.functor.name) {
							return [[]];
						} else {
							return [];
						}
					} else {
						return [];
					}
				}
				break;

			case BW_SIZE_SMALL:
			case BW_SIZE_MEDIUM:
			case BW_SIZE_LARGE:
				{
					let id:TermAttribute = predicate.attributes[0];
					if (id instanceof VariableTermAttribute) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							if (this.bw.objects[idx].size == predicate.functor.name) {
								bindings.push([[id, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;
					} else if (id instanceof ConstantTermAttribute) {
						if (this.bw.objects[this.bw.idHash[(<ConstantTermAttribute>id).value]].size == predicate.functor.name) {
							return [[]];
						} else {
							return [];
						}
					} else {
						return [];
					}
				}
				break;

			case "color":
				{
					let a1:TermAttribute = predicate.attributes[0];
					let a2:TermAttribute = predicate.attributes[1];
					if ((a1 instanceof ConstantTermAttribute) &&
					    (a2 instanceof ConstantTermAttribute)) {
						let id:string = (<ConstantTermAttribute>a1).value;
						let color:string = (<ConstantTermAttribute>a2).value;

						if (this.bw.objects[this.bw.idHash[id]].color == color) {
							return [[]];
						} else {
							return [];
						}

					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof ConstantTermAttribute)) {
						let color:string = (<ConstantTermAttribute>a2).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							if (this.bw.objects[idx].color == color) {
								bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;

					}  else if ((a1 instanceof ConstantTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let id:string = (<ConstantTermAttribute>a1).value;
						let color:string = this.bw.objects[this.bw.idHash[id]].color;
						return [[[a2, new ConstantTermAttribute(color, o.getSort(color))]]];

					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							let color:string = this.bw.objects[idx].color;
							bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)],
										   [a2, new ConstantTermAttribute(color, o.getSort(color))]]);
						}
						return bindings;
					}					
				}
				break;

			case "shape":
				{
					let a1:TermAttribute = predicate.attributes[0];
					let a2:TermAttribute = predicate.attributes[1];
					if ((a1 instanceof ConstantTermAttribute) &&
					    (a2 instanceof ConstantTermAttribute)) {
						let id:string = (<ConstantTermAttribute>a1).value;
						let shape:string = (<ConstantTermAttribute>a2).value;

						if (this.bw.objects[this.bw.idHash[id]].shape == shape) {
							return [[]];
						} else {
							return [];
						}

					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof ConstantTermAttribute)) {
						let shape:string = (<ConstantTermAttribute>a2).value;
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							if (this.bw.objects[idx].shape == shape) {
								bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)]]);
							}
						}
						return bindings;

					}  else if ((a1 instanceof ConstantTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let id:string = (<ConstantTermAttribute>a1).value;
						let shape:string = this.bw.objects[this.bw.idHash[id]].shape;
						if (shape != null) {
							return [[[a2, new ConstantTermAttribute(shape, o.getSort(shape))]]];
						} else {
							return [];
						}
						
					}  else if ((a1 instanceof VariableTermAttribute) &&
					    		(a2 instanceof VariableTermAttribute)) {
						let bindings:[VariableTermAttribute,TermAttribute][][] = [];
						for(let idx:number = 0; idx<this.x.length; idx++) {
							let shape:string = this.bw.objects[idx].shape;
							if (shape != null) {
								bindings.push([[a1, new ConstantTermAttribute(this.bw.objects[idx].ID, BWPlanner.s_id_sort)],
											   [a2, new ConstantTermAttribute(shape, o.getSort(shape))]]);
							}
						}
						return bindings;
					}					
				}
				break;
		}

		console.error("checkPredicate: unsupported predicate: " + predicate);
		return [];
	}


	isOnTopOf(o1:number, o2:number) : boolean
	{
		if (o1 == o2) return false;
		if (this.x[o1]+this.bw.objects[o1].dx > this.x[o2] && this.x[o2]+this.bw.objects[o2].dx > this.x[o1] &&
			this.y[o1] == this.y[o2]+this.bw.objects[o2].dy &&
			this.z[o1]+this.bw.objects[o1].dz > this.z[o2] && this.z[o2]+this.bw.objects[o2].dz > this.z[o1]) {
			return true;
		}
		return false;
	}


	isInsideOf(o1:number, o2:number) : boolean
	{
		if (o1 == o2) return false;
		if (this.collide(o1, o2)) {
			// they overlap:
			if (this.x[o2] <= this.x[o1] && this.z[o2] <= this.z[o1]) {
				// o1 inside o2:
				return true;
			}
		}
		return false;
	}


	collide(o1:number, o2:number): boolean
	{
		if (this.x[o1]+this.bw.objects[o1].dx > this.x[o2] && this.x[o2]+this.bw.objects[o2].dx > this.x[o1] &&
			this.y[o1]+this.bw.objects[o1].dy > this.y[o2] && this.y[o2]+this.bw.objects[o2].dy > this.y[o1] &&
			this.z[o1]+this.bw.objects[o1].dz > this.z[o2] && this.z[o2]+this.bw.objects[o2].dz > this.z[o1]) {
			return true;
		}
		return false;
	}


	positionToPutObjectOn(o_idx:number, base_idx:number) : [number,number,number]
	{
		let base:ShrdluBlock = this.bw.objects[base_idx];

		if (base.type != SHRDLU_BLOCKTYPE_BLOCK &&
			base.type != SHRDLU_BLOCKTYPE_CUBE &&
			base.type != SHRDLU_BLOCKTYPE_BOX &&
			base.type != SHRDLU_BLOCKTYPE_TABLE) return null;

		let x1:number = this.x[base_idx];
		let y:number = this.y[base_idx] + base.dy;
		let z1:number = this.z[base_idx];
		let x2:number = this.x[base_idx] + base.dx;
		let z2:number = this.z[base_idx] + base.dz;
		if (base.type == SHRDLU_BLOCKTYPE_BOX) {
			x1 += 1;
			z1 += 1;
			x2 -= 1;
			z2 -= 1;
			y = this.y[base_idx] +1; 
		}

		let o:ShrdluBlock = this.bw.objects[o_idx];

		for(let x:number = x1; x <= x2-o.dx; x++) {
			for(let z:number = z1; z <= z2-o.dz; z++) {
				let collision:boolean = false;
				for(let o2_idx:number = 0; o2_idx<this.x.length; o2_idx++) {
					if (this.bw.objects[o2_idx].type == SHRDLU_BLOCKTYPE_BOX &&
						this.y[o2_idx] < y) continue;	// ignore this collision
					if (o2_idx != o_idx && o2_idx != base_idx) {
						if (x+o.dx > this.x[o2_idx] && this.x[o2_idx]+this.bw.objects[o2_idx].dx > x &&
							y+o.dy > this.y[o2_idx] && this.y[o2_idx]+this.bw.objects[o2_idx].dy > y &&
							z+o.dz > this.z[o2_idx] && this.z[o2_idx]+this.bw.objects[o2_idx].dz > z) {
							collision = true;
							break;
						}
					}
				}
				if (!collision) {
					return [x,y,z];
				}
			}
		}

		return null;
	}	


	bw:ShrdluBlocksWorld;
	x:number[];
	y:number[];
	z:number[];
	objectInArm:number = -1;
}


class BWPlanningPlan {

	convertToTerms(o:Ontology) : PlanningPlan
	{
		let p:PlanningPlan = new PlanningPlan();

		for(let action of this.actions) {
			if (action[0] == BW_PLANNING_ACTION_TAKE) {
				p.actions.push(new PlanningOperator(Term.fromString("action.take('shrdlu'[#id], '"+action[1]+"'[#id])", o), [], []));
			} else if (action[0] == BW_PLANNING_ACTION_PUT_IN) {
				p.actions.push(new PlanningOperator(Term.fromString("action.put-in('shrdlu'[#id], '"+action[1]+"'[#id], '"+action[2]+"'[#id])", o), [], []));
			} else {
				console.error("convertToTerms: unsupported action " + action);
			}
		}

		return p;
	}

	actions:string[][] = [];
}


class BWPlanner {
	constructor(bw:ShrdluBlocksWorld, o:Ontology) {
		this.bw = bw;
		this.o = o;
		if (BWPlanner.s_id_sort == null) {
			BWPlanner.s_id_sort = o.getSort("#id");
		}
	}


	plan(goal:PlanningCondition, maxDepth:number) : PlanningPlan
	{
		let plan:BWPlanningPlan = new BWPlanningPlan();
		let s0:BWPlannerState = BWPlannerState.fromBlocksWorld(this.bw);
		// iterative deepening:
		for(let depth:number = 1;depth<=maxDepth;depth++) {
			if (this.DEBUG >= 1) console.log("- plan -------- max depth: " + depth + " - ");
			if (this.planInternal(s0, goal, plan, depth)) {
				// plan.autoCausalLinks(s0, this.occursCheck);
				return plan.convertToTerms(this.o);
			}
		}
		return null;
	}


	planInternal(state:BWPlannerState, goal:PlanningCondition, plan:BWPlanningPlan, maxDepth:number) : boolean
	{
		if (this.DEBUG >= 1) {
			console.log("- planInternal -------- depth left: " + maxDepth + " - ");
			if (this.DEBUG >= 2) {
				console.log("State:");
				console.log(state.toString());
			}
		}
	
		// check if we are done:
		if (state.checkGoal(goal, this.o)) return true;
		if (maxDepth <= 0) return false;

		// obtain candidate actions:
		let children:[string[],BWPlannerState][] = [];
		this.generateChildren(state, children);
		if (this.DEBUG >= 1) {
			for(let tmp of children) {
				console.log("    candidate action: " + tmp[0]);
			}
		}

		// search:
		for(let [action,next_state] of children) {
			plan.actions.push(action)
			if (this.DEBUG >= 1) console.log("Executing action: " + action);
			if (this.planInternal(next_state, goal, plan, maxDepth-1)) return true;
			plan.actions.pop();
		}

		return false;
	}


	generateChildren(state:BWPlannerState, children:[string[],BWPlannerState][])
	{
		if (state.objectInArm == -1) {
			// take actions:
			for(let idx:number = 0; idx<state.x.length; idx++) {
				if (this.bw.objects[idx].type == SHRDLU_BLOCKTYPE_BLOCK ||
					this.bw.objects[idx].type == SHRDLU_BLOCKTYPE_CUBE ||
					this.bw.objects[idx].type == SHRDLU_BLOCKTYPE_PYRAMID ||
					this.bw.objects[idx].type == SHRDLU_BLOCKTYPE_BOX) {
					let canBeTaken:boolean = true;
					for(let idx2:number = 0; idx2<state.x.length; idx2++) {
						if (state.isOnTopOf(idx2, idx) ||
							state.isInsideOf(idx2, idx)) {
							canBeTaken = false;
							break;
						}
					}
					if (canBeTaken) {
						let op:string[] = [BW_PLANNING_ACTION_TAKE, this.bw.objects[idx].ID];
						let nextState:BWPlannerState = BWPlannerState.clone(state);
						nextState.y[idx] = 10000;
						nextState.objectInArm = idx;
						children.push([op, nextState])
					}
				}		
			}
		} else {
			// put in actions:
			for(let idx:number = 0; idx<state.x.length; idx++) {
				let position:[number, number, number] = state.positionToPutObjectOn(state.objectInArm, idx);
				if (position != null) {
					let op:string[] = [BW_PLANNING_ACTION_PUT_IN, this.bw.objects[state.objectInArm].ID, this.bw.objects[idx].ID];
					let nextState:BWPlannerState = BWPlannerState.clone(state);
					nextState.x[state.objectInArm] = position[0];
					nextState.y[state.objectInArm] = position[1];
					nextState.z[state.objectInArm] = position[2];
					nextState.objectInArm = -1;
					children.push([op, nextState])
				}
			}
		}
	}


	DEBUG:number = 0;
	bw:ShrdluBlocksWorld = null;
	o:Ontology = null;
	occursCheck:boolean = false;

	static s_id_sort:Sort = null;
}
