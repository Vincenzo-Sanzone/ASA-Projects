import path from 'path';
import { readFile, Logger, saveFile, executeUntilDone } from '../utility/index.js';
import { onlineSolver, PddlExecutor, PddlProblem, Beliefset } from "@unitn-asa/pddl-client";


class Pddl {
    static #cache = {};

    constructor(socket, chosenPlan, intention) {
        this.domain = null;
        this.problem = null;
        this.beliefset = new Beliefset();
        this.goal = null;
        this.chosenPlan = chosenPlan;
        this.socket = socket;
        this.executor = new PddlExecutor();

        this.logger = new Logger("PDDL:", intention ? intention.beliefs.me.name : null);
        if (intention) this.addAllAction(intention.beliefs);
    }

    /**
     * Loads the PDDL domain file for the chosen plan.
     */
    async #loadDomain() {
        try {
            const [domainContent] = await Promise.all([
                readFile(path.join('pddl', 'domains', `${this.chosenPlan}.pddl`)),
            ]);
            this.domain = domainContent;
        } catch (error) {
            console.error("Error loading PDDL files:", error);
            throw error;
        }
    }

    /**
     * Loads the PDDL problem for the chosen plan.
     */
    async #loadProblem() {
        this.problem = new PddlProblem(
            this.chosenPlan,
            this.beliefset.objects.join(' '),
            this.beliefset.toPddlString(),
            this.goal
        ).toPddlString();

        // Replace all default with chosen plan
        this.problem = this.problem.replace(/default/g, this.chosenPlan);

        saveFile(path.join('pddl', 'problems', 'debug', `${this.chosenPlan}.pddl`), this.problem)
    }

    /**
     * Solves the loaded PDDL problem using an online solver. 
     */
    async solve() {
        await this.#loadDomain();
        await this.#loadProblem();
        if (!this.domain || !this.problem) {
            throw new Error("Domain and problem must be loaded before solving.");
        }
        if (this.#getCache(this.problem)) {
            this.logger.info("Using cached plan for problem.");
            const plan = this.#getCache(this.problem);
            return plan;
        }
        try {
            this.logger.debug("Solving PDDL problem...");
            const plan = await executeUntilDone(onlineSolver, this.domain, this.problem);
            this.#addCache(this.problem, plan);
            return plan;
        } catch (error) {
            this.logger.error("Error solving PDDL problem:", error);
            throw error;
        }
    }

    /**
     * Executes the given plan using the PDDL executor.
     * @param {Array} plan - The plan to execute, as returned by the solver.
     */
    async executePlan(plan) {
        await this.executor.exec(plan)
    }

    /**
     * Adds a goal to the PDDL problem. Subclasses must implement this method to define how the goal is added.
     */
    addGoal(...args) {
        throw new Error("Method 'addGoal()' must be implemented by subclasses.");
    }

    /**
     * Adds a belief to the belief set. Subclasses must implement this method to define how beliefs are added. 
     */
    addBelief(...args) {
        throw new Error("Method 'addBelief()' must be implemented by subclasses.");
    }

    /**
     * Add all the actions to the PDDL executor.
     */
    addAllAction(belief) {
        throw new Error("Method 'addAllAction()' must be implemented by subclasses.")
    }

    #addCache(key, value) {
        // Remove the row ;; problem file: problem-XXXXXX.pddl from the string
        key = key.replace(/problem.*\.pddl/g, 'problem.pddl');
        Pddl.#cache[key] = value;
        this.logger.info(`Now we have ${Object.keys(Pddl.#cache).length} cached plans.`);
    }

    #getCache(key) {
        // Remove the row ;; problem file: problem-XXXXXX.pddl from the string
        key = key.replace(/problem.*\.pddl/g, 'problem.pddl');
        return Pddl.#cache[key];
    }

    static clearCache() {
        Pddl.#cache = {};
    }
}

export { Pddl };