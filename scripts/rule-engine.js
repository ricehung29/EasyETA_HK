// Rule Engine
// Evaluates rules using both visual conditions and custom scripts

const RuleEngine = {
    /**
     * Evaluate a rule against the current context
     * @param {Object} rule - The rule to evaluate
     * @param {Object} context - The evaluation context (time, ETA, etc.)
     * @returns {Promise<boolean>} True if rule should trigger
     */
    async evaluate(rule, context) {
        try {
            if (!rule?.enabled || !context?.currentTime) return false;
            // Check rule type
            if (rule.type === 'one-time') {
                return this.evaluateOneTime(rule, context);
            } else if (rule.type === 'recurring') {
                return this.evaluateRecurring(rule, context);
            } else if (rule.type === 'conditional') {
                return this.evaluateConditional(rule, context);
            }
            
            return false;
        } catch (error) {
            console.error('Rule evaluation error:', error);
            return false;
        }
    },

    /**
     * Evaluate a one-time rule
     */
    evaluateOneTime(rule, context) {
        if (!rule.date || !rule.time) return false;
        
        const now = new Date();
        const [year, month, day] = rule.date.split('-').map(Number);
        const [hour, minute] = rule.time.split(':').map(Number);
        
        // Check if it's the right date and time (within 1 minute window)
        const isRightDate = now.getFullYear() === year &&
                           now.getMonth() + 1 === month &&
                           now.getDate() === day;
        const isRightTime = now.getHours() === hour &&
                           now.getMinutes() === minute;
        
        if (!isRightDate || !isRightTime) return false;
        
        // Make sure we haven't triggered this one-time rule already
        if (rule.lastTriggered) {
            const lastTrigger = new Date(rule.lastTriggered);
            const timeSinceLastTrigger = now - lastTrigger;
            if (timeSinceLastTrigger < 60000) { // Less than 1 minute
                return false;
            }
        }
        
        return true;
    },

    /**
     * Evaluate a recurring rule
     */
    evaluateRecurring(rule, context) {
        if (!rule.time) return false;
        
        const [hour, minute] = rule.time.split(':').map(Number);
        
        // Check if it's the right time (within 1 minute window)
        const isRightTime = context.currentTime.hour === hour &&
                           context.currentTime.minute === minute;
        
        if (!isRightTime) return false;
        
        // Check if it's the right day of week
        if (rule.days && rule.days.length > 0) {
            if (!rule.days.includes(context.currentTime.day)) {
                return false;
            }
        }
        
        // Prevent triggering multiple times in the same minute
        if (rule.lastTriggered) {
            const lastTrigger = new Date(rule.lastTriggered);
            const now = new Date();
            const timeSinceLastTrigger = now - lastTrigger;
            if (timeSinceLastTrigger < 60000) { // Less than 1 minute
                return false;
            }
        }
        
        return true;
    },

    /**
     * Evaluate a conditional rule (visual or script mode)
     */
    evaluateConditional(rule, context) {
        // Custom scripts are intentionally not evaluated in the privileged extension context.
        return rule.mode === 'script' ? false : this.evaluateVisualConditions(rule, context);
    },

    /**
     * Evaluate visual conditions
     */
    evaluateVisualConditions(rule, context) {
        if (!rule.conditions || !rule.conditions.rules) {
            return false;
        }
        
        const operator = rule.conditions.operator || 'AND';
        const conditions = rule.conditions.rules;
        
        if (!conditions.length) return false;
        const results = conditions.map(condition =>
            this.evaluateSingleCondition(condition, context)
        );
        
        if (operator === 'AND') {
            return results.every(r => r === true);
        } else if (operator === 'OR') {
            return results.some(r => r === true);
        }
        
        return false;
    },

    /**
     * Evaluate a single condition
     */
    evaluateSingleCondition(condition, context) {
        const { field, operator, value, target } = condition;
        
        // Get the actual value from context
        let actualValue;
        
        switch (field) {
            case 'time':
                actualValue = `${context.currentTime.hour}:${String(context.currentTime.minute).padStart(2, '0')}`;
                break;
            case 'day':
                actualValue = context.currentTime.day;
                break;
            case 'eta':
                if (target === 'next_bus') actualValue = context.eta?.next;
                else if (target === 'second_bus') actualValue = context.eta?.second;
                if (!Number.isFinite(actualValue)) return false;
                break;
            default:
                actualValue = null;
        }
        
        // Compare based on operator
        switch (operator) {
            case '==':
            case 'equals':
                return actualValue == value;
            case '!=':
            case 'not_equals':
                return actualValue != value;
            case '<':
            case 'less_than':
                return actualValue < value;
            case '>':
            case 'greater_than':
                return actualValue > value;
            case '<=':
                return actualValue <= value;
            case '>=':
                return actualValue >= value;
            case 'in':
                return Array.isArray(value) && value.includes(actualValue);
            case 'between':
                return Array.isArray(value) && 
                       actualValue >= value[0] && 
                       actualValue <= value[1];
            default:
                return false;
        }
    },

    /**
     * Evaluate custom script
     */
    evaluateScript() {
        // Custom JavaScript rules are disabled: extension-stored scripts are untrusted input.
        return false;
    },

    /**
     * Validate a rule's structure
     */
    validateRule(rule) {
        const errors = [];
        
        if (!rule.name || rule.name.trim() === '') {
            errors.push('Rule name is required');
        }
        
        if (!rule.type || !['recurring', 'one-time', 'conditional'].includes(rule.type)) {
            errors.push('Invalid rule type');
        }
        
        if (rule.type === 'recurring' && !rule.time) {
            errors.push('Recurring rules require a time');
        }
        
        if (rule.type === 'one-time' && (!rule.date || !rule.time)) {
            errors.push('One-time rules require both date and time');
        }
        
        if (rule.type === 'conditional' && !rule.conditions && !rule.script) {
            errors.push('Conditional rules require either conditions or script');
        }
        
        if (rule.mode === 'script') {
            errors.push('Script rules are not supported safely');
        }
        if (rule.type === 'conditional' && rule.mode !== 'script' &&
            (!rule.conditions?.rules?.length || !['AND', 'OR'].includes(rule.conditions.operator || 'AND'))) {
            errors.push('Conditional rules require one or more valid visual conditions');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
}
